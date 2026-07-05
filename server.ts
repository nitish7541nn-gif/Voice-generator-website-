import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined. Please define it in application secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Helper function to insert a standard 44-byte RIFF WAV header to raw PCM bytes
function addWavHeader(
  pcmBuffer: Buffer,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const header = Buffer.alloc(44);
  const dataLength = pcmBuffer.length;
  const fileLength = dataLength + 36;

  header.write("RIFF", 0);
  header.writeUInt32LE(fileLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // 1 = Raw linear PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  header.writeUInt32LE(byteRate, 28);
  const blockAlign = (numChannels * bitsPerSample) / 8;
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// Helper function to extract exact retry delay in ms from 429 Quota Exceeded error
function parseRetryDelayMs(error: any): number {
  try {
    const errorStr = typeof error === "string" ? error : JSON.stringify(error);
    const retryDelayMatch = errorStr.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
    if (retryDelayMatch && retryDelayMatch[1]) {
      return Math.ceil(parseFloat(retryDelayMatch[1]) * 1000) + 1000;
    }
    const retryInMatch = errorStr.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
    if (retryInMatch && retryInMatch[1]) {
      return Math.ceil(parseFloat(retryInMatch[1]) * 1000) + 1000;
    }
  } catch (e) {
    // ignore parse error
  }
  return 10000; // Default fallback delay of 10s for 429 rate limit
}

// Helper function to split long text into clean, natural speech chunks (up to ~3200 chars)
function splitTextIntoChunks(text: string, maxChunkLength: number = 3200): string[] {
  const chunks: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.length <= maxChunkLength) {
    return [trimmed];
  }

  // Split text by sentence boundaries (. ! ? । \n)
  const sentences = trimmed.split(/(?<=[.!?।\n])\s+/);
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + (currentChunk ? " " : "") + sentence).length <= maxChunkLength) {
      currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      if (sentence.length > maxChunkLength) {
        // Split by clause punctuation (commas, semicolons)
        const clauses = sentence.split(/(?<=[,;|])\s+/);
        let clauseChunk = "";
        for (const clause of clauses) {
          if ((clauseChunk + (clauseChunk ? " " : "") + clause).length <= maxChunkLength) {
            clauseChunk = clauseChunk ? `${clauseChunk} ${clause}` : clause;
          } else {
            if (clauseChunk.trim()) chunks.push(clauseChunk.trim());
            if (clause.length > maxChunkLength) {
              // Word level splitting as fallback
              const words = clause.split(/\s+/);
              let wordChunk = "";
              for (const word of words) {
                if ((wordChunk + (wordChunk ? " " : "") + word).length <= maxChunkLength) {
                  wordChunk = wordChunk ? `${wordChunk} ${word}` : word;
                } else {
                  if (wordChunk.trim()) chunks.push(wordChunk.trim());
                  wordChunk = word;
                }
              }
              clauseChunk = wordChunk.trim();
            } else {
              clauseChunk = clause;
            }
          }
        }
        currentChunk = clauseChunk.trim();
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Multi-provider resilient TTS generator (Supports long text, multi-batching, multi-provider fallback)
async function generateFallbackAudio(text: string, lang: string = "hi"): Promise<Buffer> {
  const langCode = (lang || "hi").split("-")[0] || "hi";
  const maxLen = 180;
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Empty text for fallback TTS");

  const chunks: string[] = [];
  let remaining = trimmed;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let cutIdx = remaining.lastIndexOf(" ", maxLen);
    if (cutIdx <= 0) cutIdx = maxLen;
    chunks.push(remaining.slice(0, cutIdx).trim());
    remaining = remaining.slice(cutIdx).trim();
  }

  const voiceName = langCode === 'hi' ? 'Aditi' :
                    langCode === 'ta' ? 'Valluvar' :
                    langCode === 'fr' ? 'Mathieu' :
                    langCode === 'es' ? 'Conchita' :
                    langCode === 'de' ? 'Hans' : 'Brian';

  const fetchChunkWithFallback = async (chunk: string): Promise<Buffer> => {
    if (!chunk.trim()) return Buffer.alloc(0);
    const encoded = encodeURIComponent(chunk);

    const providers = [
      `https://api.streamelements.com/kappa/v2/speech?voice=${voiceName}&text=${encoded}`,
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${langCode}&client=gtx`,
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${langCode}&client=tw-ob`,
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${langCode}&client=dict-chrome-ex`
    ];

    for (const url of providers) {
      try {
        const response = await axios.get(url, {
          responseType: "arraybuffer",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          timeout: 7000
        });
        const buf = Buffer.from(response.data);
        if (buf && buf.length > 100) {
          return buf;
        }
      } catch (e) {
        // Try next provider
      }
    }
    return Buffer.alloc(0);
  };

  // Process in small batches of 3 to avoid saturating network or rate-limiting
  const BATCH_SIZE = 3;
  const mp3Buffers: Buffer[] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((c) => fetchChunkWithFallback(c)));
    mp3Buffers.push(...batchResults);
  }

  const validBuffers = mp3Buffers.filter((b) => b && b.length > 100);

  if (validBuffers.length === 0) {
    throw new Error("Failed to fetch audio stream");
  }

  return Buffer.concat(validBuffers);
}

async function generateAudioForChunk(
  textChunk: string, 
  voiceID: string, 
  maxRetries: number = 0
): Promise<Buffer> {
  let lastError: any = null;

  // Map voice ID to Gemini prebuilt voice and persona directive
  let geminiVoice = "Kore";
  let voicePersona = `Speak in a clear natural female voice`;

  if (voiceID === 'Charon') {
    geminiVoice = "Charon";
    voicePersona = `Speak in a deep baritone male voice`;
  } else if (voiceID === 'Puck') {
    geminiVoice = "Puck";
    voicePersona = `Speak in a natural clear male voice`;
  } else if (voiceID === 'Fenrir') {
    geminiVoice = "Fenrir";
    voicePersona = `Speak in a strong energetic male voice`;
  } else if (voiceID === 'Aoede') {
    geminiVoice = "Aoede";
    voicePersona = `Speak in a soft, gentle, calm whispering female voice`;
  } else if (voiceID === 'Priya') {
    geminiVoice = "Kore";
    voicePersona = `Speak in a confident, crisp, formal Indian news anchor female voice`;
  } else if (voiceID === 'Ananya') {
    geminiVoice = "Aoede";
    voicePersona = `Speak in a cheerful, energetic, bright young girl voice`;
  } else if (voiceID === 'Kavya') {
    geminiVoice = "Kore";
    voicePersona = `Speak in a warm, emotional, storytelling female voice`;
  } else if (voiceID === 'Sunita') {
    geminiVoice = "Aoede";
    voicePersona = `Speak in a professional, formal corporate executive female voice`;
  } else if (voiceID === 'Riya') {
    geminiVoice = "Kore";
    voicePersona = `Speak in an upbeat, friendly, Radio Jockey RJ female voice`;
  } else if (voiceID === 'Shalini') {
    geminiVoice = "Aoede";
    voicePersona = `Speak in a clear, patient, educational teacher female voice`;
  } else {
    geminiVoice = "Kore";
    voicePersona = `Speak in a clear natural female voice`;
  }

  // Parse story expression and pacing tags ([slow], [fast], [pause], [dramatic], [whisper], [excited])
  let formattedText = textChunk;
  formattedText = formattedText.replace(/\[pause\]/gi, " ... (pausing for 1 second) ... ");
  formattedText = formattedText.replace(/\[pause:(\d+)s\]/gi, (_, sec) => ` ... (pausing for ${sec} seconds) ... `);
  formattedText = formattedText.replace(/\[slow\]([\s\S]*?)\[\/slow\]/gi, ' (speaking slowly: "$1") ');
  formattedText = formattedText.replace(/\[fast\]([\s\S]*?)\[\/fast\]/gi, ' (speaking rapidly: "$1") ');
  formattedText = formattedText.replace(/\[dramatic\]([\s\S]*?)\[\/dramatic\]/gi, ' (speaking with suspense: "$1") ');
  formattedText = formattedText.replace(/\[whisper\]([\s\S]*?)\[\/whisper\]/gi, ' (whispering: "$1") ');
  formattedText = formattedText.replace(/\[excited\]([\s\S]*?)\[\/excited\]/gi, ' (excitedly: "$1") ');
  formattedText = formattedText.replace(/\[sad\]([\s\S]*?)\[\/sad\]/gi, ' (sadly: "$1") ');

  const voicePrompt = `${voicePersona}: ${formattedText}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await getGeminiClient().models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: voicePrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: geminiVoice },
            },
          },
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.[0];
      const base64Audio = part?.inlineData?.data;

      if (!base64Audio) {
        throw new Error("No audio content received from Gemini model for chunk");
      }

      return Buffer.from(base64Audio, "base64");
    } catch (err: any) {
      lastError = err;
      const errMessage = err?.message || String(err);
      throw new Error(`Gemini TTS Error: ${errMessage}`);
    }
  }

  throw new Error(`Failed audio chunk generation: ${lastError?.message || lastError}`);
}

async function generateFullAudio(text: string, voice: string): Promise<Buffer> {
  const validVoices = ["Puck", "Charon", "Kore", "Aoede", "Fenrir", "Priya", "Ananya", "Kavya", "Sunita", "Riya", "Shalini"];
  const voiceID = validVoices.includes(voice) ? voice : "Puck";

  const sampleRate = 24000;

  // Optimal 700 character chunk size for superfast Gemini TTS response (<2s per chunk)
  const chunks = splitTextIntoChunks(text, 700);

  if (chunks.length === 0) {
    throw new Error("Text is empty");
  }

  // Execute chunk calls concurrently
  const pcmBuffers = await Promise.all(
    chunks.map((chunk) => generateAudioForChunk(chunk, voiceID))
  );

  const combinedPcm = Buffer.concat(pcmBuffers);
  return addWavHeader(combinedPcm, sampleRate);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Handler for TTS (both GET and POST for small and massive text)
  const ttsHandler: express.RequestHandler = async (req, res) => {
    const text = req.method === "POST" ? req.body.text : req.query.text;
    const voice = req.method === "POST" ? req.body.voice : req.query.voice;
    const style = req.method === "POST" ? req.body.style : req.query.style;
    const lang = req.method === "POST" ? req.body.lang : req.query.lang;
    const isFastMode = req.method === "POST" ? (req.body.fastMode || req.body.engine === 'fast') : (req.query.fastMode === 'true' || req.query.engine === 'fast');

    if (!text || typeof text !== "string" || !text.trim()) {
      res.status(400).send("Text is required");
      return;
    }

    const cleanText = text.trim();

    // For large texts (>500 chars) or when fastMode is requested, use instant parallel synthesis engine
    if (isFastMode || cleanText.length > 500) {
      try {
        console.log(`[Fast Engine Active] Instant audio generation for ${cleanText.length} chars...`);
        const mp3Buffer = await generateFallbackAudio(cleanText, String(lang || "hi"));
        res.set("Content-Type", "audio/mpeg");
        res.set("Content-Length", mp3Buffer.length.toString());
        res.send(mp3Buffer);
        return;
      } catch (fastErr: any) {
        console.warn("Fast Engine failed, attempting Gemini TTS fallback:", fastErr.message);
      }
    }

    try {
      // Primary: Try Gemini 3.1 TTS with a tight 3.5s race timeout
      const geminiPromise = generateFullAudio(cleanText, String(voice || "Kore"));
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("Gemini TTS response timeout (>3.5s)")), 3500)
      );

      const wavBuffer = await Promise.race([geminiPromise, timeoutPromise]);
      res.set("Content-Type", "audio/wav");
      res.set("Content-Length", wavBuffer.length.toString());
      res.send(wavBuffer);
    } catch (geminiError: any) {
      console.warn("Gemini TTS timeout or error. Switching to instant fallback TTS:", geminiError.message);
      try {
        const mp3Buffer = await generateFallbackAudio(cleanText, String(lang || "hi"));
        res.set("Content-Type", "audio/mpeg");
        res.set("Content-Length", mp3Buffer.length.toString());
        res.send(mp3Buffer);
      } catch (fallbackError: any) {
        console.error("Fallback TTS error:", fallbackError);
        res.status(500).send(geminiError.message || "Error generating speech audio");
      }
    }
  };

  app.get("/api/tts", ttsHandler);
  app.post("/api/tts", ttsHandler);
  app.get("/api/generate-tts", ttsHandler);
  app.post("/api/generate-tts", ttsHandler);

  // Secure Server-side Smart Rewrite endpoint using gemini-3.5-flash
  app.post("/api/rewrite", async (req, res) => {
    const { text, mood, lang } = req.body;

    if (!text) {
      return res.status(400).send("Text is required");
    }

    try {
      let prompt = "";
      if (mood === "kahani" || mood === "story_expression") {
        prompt = `You are an expert Hindi/English Audiobook Director and Storytelling Assistant.
Transform the following text into a highly expressive, dramatic storytelling script by embedding emotional expression tags and pacing pauses.

RULES & TAGS TO INSERT:
1. Insert [pause] or "..." where the speaker should pause for dramatic effect or breathing.
2. Wrap slow, suspenseful, or serious lines in [slow]sentence[/slow].
3. Wrap fast, urgent, or action-packed lines in [fast]sentence[/fast].
4. Wrap dramatic, emotional, or climax moments in [dramatic]sentence[/dramatic].
5. Wrap quiet secrets or whispers in [whisper]sentence[/whisper].
6. Wrap excited, cheerful, or loud lines in [excited]sentence[/excited].

Keep the story language in ${lang || "Hindi"}. Do not change the underlying meaning or plot. Do NOT include any intro, explanation, or meta commentary. Return ONLY the formatted script with tags.

Original Text:
"${text}"`;
      } else {
        prompt = `Rewrite the following text to sound strictly ${mood || "expressive"} in ${lang || "Hindi"}. 
Keep it natural, concise, and beautifully readable. Do not add any intro commentary or meta-text, just return the rewritten text directly.

Text: "${text}"`;
      }

      const response = await getGeminiClient().models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      res.json({ text: response.text?.trim() || text });
    } catch (error: any) {
      console.error("AI Rewriting error:", error);
      res.status(500).send(error.message || "Error with AI rewrite");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
