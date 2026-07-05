/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic2, Play, Square, Download, Trash2, Wand2, 
  Settings, Languages, Volume2, FastForward, Activity,
  Music, Github, Share2, Info, Loader2, SlidersHorizontal, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { rewriteText } from './lib/gemini.ts';

// --- Types ---
interface VoiceSettings {
  lang: string;
  speed: number;
  pitch: number;
  volume: number;
  voice: string;
}

// --- Constants ---
const LANGUAGES = [
  { code: 'hi-IN', label: '🇮🇳 Hindi', native: 'हिंदी', p: 1.0, r: 1.0 },
  { code: 'en-US', label: '🇺🇸 English', native: 'English', p: 1.1, r: 1.1 },
  { code: 'ta-IN', label: '🇮🇳 Tamil', native: 'தமிழ்', p: 1.15, r: 0.95 },
  { code: 'te-IN', label: '🇮🇳 Telugu', native: 'తెలుగు', p: 1.1, r: 0.98 },
  { code: 'bn-IN', label: '🇮🇳 Bengali', native: 'বাংলা', p: 1.05, r: 0.97 },
  { code: 'mr-IN', label: '🇮🇳 Marathi', native: 'मराठी', p: 1.0, r: 1.0 },
  { code: 'gu-IN', label: '🇮🇳 Gujarati', native: 'ગુજરાતી', p: 1.05, r: 1.02 },
  { code: 'fr-FR', label: '🇫🇷 French', native: 'Français', p: 1.15, r: 1.05 },
  { code: 'de-DE', label: '🇩🇪 German', native: 'Deutsch', p: 0.95, r: 0.98 },
  { code: 'es-ES', label: '🇪🇸 Spanish', native: 'Español', p: 1.1, r: 1.08 },
];

const AI_VOICES = [
  // 👩 Female / Ladies Voices (महिला आवाजें - ElevenLabs Style)
  { id: 'Kore', label: '👩 कोरिया (Kore - Natural Female AI)', desc: 'Clear Natural Female Voice', gender: 'female', pitchOffset: 1.0 },
  { id: 'Aoede', label: '👩 आयोड (Aoede - Soft & Gentle Female)', desc: 'Soft Whispering Calm Female Voice', gender: 'female', pitchOffset: 1.15 },
  { id: 'Priya', label: '👩 प्रिया (Priya - News Anchor Female)', desc: 'Confident & Crisp News Reader Voice', gender: 'female', pitchOffset: 1.05 },
  { id: 'Ananya', label: '👩 अनन्या (Ananya - Young Energetic Girl)', desc: 'Cheerful & Bright Young Female Voice', gender: 'female', pitchOffset: 1.25 },
  { id: 'Kavya', label: '👩 काव्या (Kavya - Storyteller Woman)', desc: 'Warm, Expressive & Melodic Voice', gender: 'female', pitchOffset: 0.95 },
  { id: 'Sunita', label: '👩 सुनिता (Sunita - Professional Business)', desc: 'Formal Corporate Executive Voice', gender: 'female', pitchOffset: 1.02 },
  { id: 'Riya', label: '👩 रिया (Riya - Radio Jockey RJ)', desc: 'Upbeat & Friendly RJ Voice', gender: 'female', pitchOffset: 1.10 },
  { id: 'Shalini', label: '👩 शालिनी (Shalini - Teacher / Educator)', desc: 'Clear & Patient Teacher Voice', gender: 'female', pitchOffset: 1.08 },

  // 👨 Male Voices (पुरुष आवाजें)
  { id: 'Puck', label: '👨 पक् (Puck - Natural Male AI Voice)', desc: 'Clear Natural Male Voice', gender: 'male', pitchOffset: 1.0 },
  { id: 'Charon', label: '👨 कैरोन (Charon - Deep Baritone AI)', desc: 'Deep Male Baritone Voice', gender: 'male', pitchOffset: 0.85 },
  { id: 'Fenrir', label: '👨 फेनरिर (Fenrir - Expressive Male)', desc: 'Strong Expressive Male Voice', gender: 'male', pitchOffset: 0.95 },
];

export default function App() {
  const [text, setText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [status, setStatus] = useState<{ msg: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [settings, setSettings] = useState<VoiceSettings>({
    lang: 'hi-IN',
    speed: 1,
    pitch: 1,
    volume: 80,
    voice: 'Puck'
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    return () => {
      stop();
    };
  }, []);

  const showStatus = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 4000);
  };

  const speak = async () => {
    if (!text.trim()) return showStatus('Please enter some text!', 'error');

    stop();

    const wordCount = text.trim().split(/\s+/).length;

    setIsSpeaking(true);
    if (wordCount > 250) {
      showStatus(`⚡ Superfast Mode: Synthesizing voice for ${wordCount} words...`, 'info');
    } else {
      showStatus('Generating natural AI voice...', 'info');
    }

    try {
      let response: Response | null = null;
      const ttsEndpoints = ['/api/tts', '/.netlify/functions/tts'];

      for (const ep of ttsEndpoints) {
        try {
          const res = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: text,
              lang: settings.lang,
              voice: settings.voice,
              fastMode: text.length > 400
            })
          });
          if (res.ok) {
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('text/html')) {
              response = res;
              break;
            }
          }
        } catch (e) {
          // try next
        }
      }

      if (!response) {
        throw new Error('Server audio endpoint not reachable');
      }

      const blob = await response.blob();

      // Web Audio API for guaranteed distinct male/female pitch and tone tuning
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        try {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;

          const arrayBuffer = await blob.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.playbackRate.value = settings.speed;

          // Pitch shift in cents (100 cents = 1 semitone)
          let detuneCents = 0;
          if (settings.voice === 'Charon') {
            detuneCents = -380; // Deep Baritone Male
          } else if (settings.voice === 'Puck') {
            detuneCents = -180; // Clear Natural Male
          } else if (settings.voice === 'Fenrir') {
            detuneCents = -240; // Strong Expressive Male
          } else if (settings.voice === 'Aoede') {
            detuneCents = +180; // Soft Gentle Female
          } else if (settings.voice === 'Priya') {
            detuneCents = +80;  // Confident News Anchor Female
          } else if (settings.voice === 'Ananya') {
            detuneCents = +320; // Cheerful Young Girl Voice
          } else if (settings.voice === 'Kavya') {
            detuneCents = -60;  // Warm Melodic Storyteller Woman
          } else if (settings.voice === 'Sunita') {
            detuneCents = +120; // Professional Corporate Female
          } else if (settings.voice === 'Riya') {
            detuneCents = +220; // Upbeat Radio Jockey Female
          } else if (settings.voice === 'Shalini') {
            detuneCents = +140; // Clear Teacher Female
          } else {
            detuneCents = +20;  // Natural Clear Female (Kore)
          }

          if (settings.pitch !== 1) {
            detuneCents += (settings.pitch - 1) * 500;
          }

          source.detune.value = detuneCents;

          // Frequency equalizer filter for voice realism
          const filter = ctx.createBiquadFilter();
          if (settings.voice === 'Charon' || settings.voice === 'Puck' || settings.voice === 'Fenrir') {
            filter.type = 'lowshelf';
            filter.frequency.value = 400;
            filter.gain.value = 6; // Deep male vocal resonance
          } else if (settings.voice === 'Ananya' || settings.voice === 'Riya') {
            filter.type = 'highshelf';
            filter.frequency.value = 3000;
            filter.gain.value = 5; // Young girl / RJ voice sparkle
          } else if (settings.voice === 'Kavya') {
            filter.type = 'peaking';
            filter.frequency.value = 800;
            filter.gain.value = 4; // Storyteller warmth
          } else {
            filter.type = 'highshelf';
            filter.frequency.value = 2400;
            filter.gain.value = 3; // Clear female vocal brilliance
          }

          const gainNode = ctx.createGain();
          gainNode.gain.value = settings.volume / 100;

          source.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(ctx.destination);

          sourceNodeRef.current = source;

          source.onended = () => {
            setIsSpeaking(false);
          };

          source.start(0);
          setIsSpeaking(true);
          showStatus('AI Voice started speaking!', 'success');
          return;
        } catch (audioErr) {
          console.warn("Web Audio API processing fallback:", audioErr);
        }
      }

      const objectUrl = URL.createObjectURL(blob);
      const audioObj = new Audio(objectUrl);

      audioObj.volume = settings.volume / 100;
      audioObj.playbackRate = settings.speed;

      audioObj.oncanplaythrough = () => {
        audioObj.playbackRate = settings.speed;
      };

      audioObj.onplay = () => {
        setIsSpeaking(true);
      };

      audioObj.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(objectUrl);
      };

      audioObj.onerror = (e) => {
        console.error("Audio playback error:", e);
        setIsSpeaking(false);
        showStatus('Error playing voice!', 'error');
        URL.revokeObjectURL(objectUrl);
      };

      audioRef.current = audioObj;
      await audioObj.play();

      showStatus('AI Voice started speaking!', 'success');
    } catch (err: any) {
      console.error(err);
      if ('speechSynthesis' in window) {
        showStatus('Playing voice via fallback synthesizer...', 'info');
        speakWithBrowserTTS();
      } else {
        setIsSpeaking(false);
        showStatus(`Failed to generate voice: ${err.message}`, 'error');
      }
    }
  };

  const speakWithBrowserTTS = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const langObj = LANGUAGES.find(l => l.code === settings.lang) || LANGUAGES[0];
      const voiceObj = AI_VOICES.find(v => v.id === settings.voice) || AI_VOICES[0];
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = settings.lang;
      utterance.rate = langObj.r * settings.speed;
      utterance.pitch = langObj.p * settings.pitch * voiceObj.pitchOffset;
      utterance.volume = settings.volume / 100;

      const voices = window.speechSynthesis.getVoices();
      const langVoices = voices.filter(v => v.lang === settings.lang || v.lang.startsWith(settings.lang.split('-')[0]));
      
      const isFemale = voiceObj.id === 'Kore' || voiceObj.id === 'Aoede';
      let preferredVoice = langVoices.find(v => 
        isFemale ? (v.name.includes('Female') || v.name.includes('Google') || v.name.includes('Natural'))
                 : (v.name.includes('Male') || v.name.includes('David') || v.name.includes('Mark'))
      ) || langVoices[0];

      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => {
        setIsSpeaking(false);
        showStatus('Speech Error!', 'error');
      };

      window.speechSynthesis.speak(utterance);
    }
  };

  const stop = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch(e) {}
      sourceNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch(e) {}
      audioCtxRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const handleRewrite = async () => {
    if (!text.trim()) return;
    setIsRewriting(true);
    try {
      const rewritten = await rewriteText(text, 'natural', settings.lang);
      setText(rewritten);
      showStatus('Text rewritten with AI magic!', 'success');
    } catch (e) {
      showStatus('AI Rewrite failed', 'error');
    } finally {
      setIsRewriting(false);
    }
  };

  // Helper to encode AudioBuffer to a standard 16-bit PCM WAV Blob for browser download
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    let result: Float32Array;
    if (numChannels === 2) {
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      result = new Float32Array(left.length + right.length);
      for (let i = 0; i < left.length; i++) {
        result[i * 2] = left[i];
        result[i * 2 + 1] = right[i];
      }
    } else {
      result = buffer.getChannelData(0);
    }

    const dataLength = result.length * 2;
    const headerLength = 44;
    const wav = new Uint8Array(headerLength + dataLength);
    const view = new DataView(wav.buffer);

    const writeString = (v: DataView, offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        v.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    let offset = 44;
    for (let i = 0; i < result.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, result[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([wav], { type: 'audio/wav' });
  };

  // Client-Side Superfast TTS Audio Generator for Netlify / Static Hosting Deployments
  const generateClientSideAudioDownload = async () => {
    showStatus('⚡ Superfast Mode: Generating audio file directly in browser...', 'info');
    const cleanLang = (settings.lang || 'hi-IN').split('-')[0];
    
    // Sanitize text from bullet symbols and tags
    const cleanText = text
      .replace(/[•·*#_~`]/g, ' ')
      .replace(/\[\/?(pause|slow|fast|dramatic|whisper|excited|sad)(:\d+s)?\]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) throw new Error('Text is empty!');

    // Split text into ~180 char chunks cut cleanly at sentence endings or spaces
    const maxLen = 180;
    const chunks: string[] = [];
    let remaining = cleanText;

    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      let cutIdx = remaining.lastIndexOf(' ', maxLen);
      if (cutIdx <= 0) cutIdx = maxLen;
      chunks.push(remaining.slice(0, cutIdx).trim());
      remaining = remaining.slice(cutIdx).trim();
    }

    // Voice mapping for StreamElements fallback
    const voiceName = cleanLang === 'hi' ? 'Aditi' :
                      cleanLang === 'ta' ? 'Valluvar' :
                      cleanLang === 'fr' ? 'Mathieu' :
                      cleanLang === 'es' ? 'Conchita' :
                      cleanLang === 'de' ? 'Hans' : 'Brian';

    // Single chunk downloader with 7s timeout for mobile 4G networks
    const fetchSingleChunk = async (chunk: string, index: number): Promise<{ index: number; buffer: ArrayBuffer | null }> => {
      if (!chunk.trim()) return { index, buffer: null };
      const encoded = encodeURIComponent(chunk);
      const rawGtUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${cleanLang}&client=gtx`;

      const endpoints = [
        `/.netlify/functions/tts?text=${encoded}&lang=${cleanLang}`,
        `/api/tts?text=${encoded}&lang=${cleanLang}`,
        `https://api.streamelements.com/kappa/v2/speech?voice=${voiceName}&text=${encoded}`,
        rawGtUrl,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(rawGtUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(rawGtUrl)}`
      ];

      for (const ep of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 7000);
          const res = await fetch(ep, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('text/html')) {
              const buf = await res.arrayBuffer();
              if (buf && buf.byteLength > 100) {
                return { index, buffer: buf };
              }
            }
          }
        } catch (e) {
          // continue to next endpoint
        }
      }
      return { index, buffer: null };
    };

    // Parallel Worker Batches (3 concurrent requests for smooth mobile execution)
    const BATCH_SIZE = 3;
    const audioBuffers: (ArrayBuffer | null)[] = new Array(chunks.length).fill(null);
    let completed = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const batchPromises = batchChunks.map((c, idx) => fetchSingleChunk(c, i + idx));
      const results = await Promise.all(batchPromises);

      for (const res of results) {
        audioBuffers[res.index] = res.buffer;
        completed++;
      }
      const pct = Math.round((completed / chunks.length) * 100);
      showStatus(`⚡ Generating Audio: ${pct}% complete...`, 'info');
    }

    const validBuffers = audioBuffers.filter((b): b is ArrayBuffer => b !== null && b.byteLength > 100);

    if (validBuffers.length === 0) {
      throw new Error("Could not download audio stream. Please check internet connection.");
    }

    // Process array buffers with AudioContext to compile into a single downloadable WAV file
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      try {
        const tempCtx = new AudioCtx();
        const decodedBuffers: AudioBuffer[] = [];

        for (const buf of validBuffers) {
          const decoded = await tempCtx.decodeAudioData(buf.slice(0));
          decodedBuffers.push(decoded);
        }

        let totalDuration = 0;
        for (const b of decodedBuffers) {
          totalDuration += b.duration;
        }

        const sampleRate = decodedBuffers[0].sampleRate;
        const totalSamples = Math.ceil(totalDuration * sampleRate);
        const mergedBuffer = tempCtx.createBuffer(1, totalSamples, sampleRate);
        const mergedChannel = mergedBuffer.getChannelData(0);

        let offset = 0;
        for (const b of decodedBuffers) {
          const channelData = b.getChannelData(0);
          mergedChannel.set(channelData, offset);
          offset += channelData.length;
        }

        await tempCtx.close();

        // Convert merged AudioBuffer to WAV Blob
        const wavBlob = audioBufferToWav(mergedBuffer);
        const url = URL.createObjectURL(wavBlob);
        setAudioUrl(url);

        const a = document.createElement('a');
        a.href = url;
        a.download = `voicewala_${settings.voice}_${Date.now()}.wav`;
        a.click();

        showStatus('Audio download started successfully!', 'success');
        return;
      } catch (procErr) {
        console.warn("AudioContext processing fallback:", procErr);
      }
    }

    // Combined Blob fallback
    const combinedBlob = new Blob(validBuffers, { type: 'audio/mp3' });
    const url = URL.createObjectURL(combinedBlob);
    setAudioUrl(url);

    const a = document.createElement('a');
    a.href = url;
    a.download = `voicewala_${settings.voice}_${Date.now()}.mp3`;
    a.click();

    showStatus('Audio download started successfully!', 'success');
  };

  const generateDownload = async () => {
    if (!text.trim()) return showStatus('Write text first!', 'error');
    setIsSynthesizing(true);
    
    const wordCount = text.trim().split(/\s+/).length;
    showStatus(`⚡ Generating superfast audio for ${wordCount} words...`, 'info');

    const apiEndpoints = [
      '/api/generate-tts',
      '/.netlify/functions/generate-tts',
      '/.netlify/functions/tts'
    ];

    for (const ep of apiEndpoints) {
      try {
        const response = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text,
            lang: settings.lang,
            voice: settings.voice,
            fastMode: true
          })
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.includes('text/html')) {
            const ext = contentType.includes('mpeg') || contentType.includes('mp3') ? 'mp3' : 'wav';
            const blob = await response.blob();
            if (blob && blob.size > 100) {
              const url = URL.createObjectURL(blob);
              setAudioUrl(url);

              const a = document.createElement('a');
              a.href = url;
              a.download = `voicewala_${settings.voice}_${Date.now()}.${ext}`;
              a.click();
              
              showStatus('Audio download started!', 'success');
              setIsSynthesizing(false);
              return;
            }
          }
        }
      } catch (e) {
        // try next endpoint
      }
    }

    console.warn("Server endpoints unreachable. Falling back to client-side audio worker...");
    try {
      await generateClientSideAudioDownload();
    } catch (fallbackErr: any) {
      console.error(fallbackErr);
      showStatus(`Download Error: ${fallbackErr.message || 'Failed to generate audio'}`, 'error');
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="min-h-screen font-sans selection:bg-indigo-500/20 text-slate-900 bg-slate-100">
      {/* Background Gradient */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-indigo-50/70 via-slate-100 to-slate-100 pointer-events-none" />

      <main className="container max-w-3xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <header id="app-header" className="flex flex-col items-center mb-8 text-center">
          <motion.div 
            id="logo-icon"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/30"
          >
            <Mic2 className="w-7 h-7 text-white" />
          </motion.div>
          <motion.h1 
            id="main-title"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-3xl md:text-4xl font-black tracking-tight text-slate-900"
          >
            VOICEWALA
          </motion.h1>
          <p id="app-subtitle" className="text-sm text-slate-600 font-bold mt-1">Simple & Powerful AI Text to Speech</p>
        </header>

        {/* Clean Single-Column Core Container */}
        <div className="space-y-5">
          {/* Main Text Area Card */}
          <section id="editor-section" className="bg-white rounded-2xl p-5 md:p-6 border-2 border-slate-200 shadow-md relative">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
                <Activity className="w-4 h-4 text-indigo-600" /> Text Editor
              </span>
              <div className="flex items-center gap-2">
                <motion.button
                  id="rewrite-btn"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleRewrite}
                  disabled={isRewriting || !text}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-all border border-indigo-200 disabled:opacity-40"
                >
                  {isRewriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  Smart Rewrite
                </motion.button>

                <button 
                  id="clear-text-btn" 
                  onClick={() => setText('')} 
                  title="Clear text"
                  className="p-1.5 hover:bg-red-50 rounded-lg text-slate-500 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <textarea
              id="main-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="यहाँ टेक्स्ट लिखें या पेस्ट करें... Type or paste any text here..."
              className="w-full bg-slate-50 border-2 border-slate-300 focus:bg-white rounded-xl p-4 text-base md:text-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 min-h-[170px] resize-none transition-all leading-relaxed font-medium"
            />

            <div className="mt-2 text-xs font-mono text-slate-600 font-bold flex justify-between items-center">
              <span>{text.trim() ? text.trim().split(/\s+/).length : 0} Words | {text.length} Chars</span>
              <span className="text-emerald-700 font-bold">Auto Long Text Processing</span>
            </div>
          </section>

          {/* Essential Quick Controls */}
          <div className="bg-white rounded-2xl p-4 border-2 border-slate-200 shadow-md grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block flex items-center gap-1.5">
                <Languages className="w-4 h-4 text-indigo-600" /> Select Language
              </label>
              <select 
                value={settings.lang}
                onChange={(e) => setSettings({...settings, lang: e.target.value})}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white cursor-pointer shadow-sm"
              >
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label} ({l.native})</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Mic2 className="w-4 h-4 text-indigo-600" /> Select Voice</span>
                <span className="text-[10px] font-bold text-indigo-700 uppercase bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200">AI Voice</span>
              </label>
              <select 
                value={settings.voice}
                onChange={(e) => setSettings({...settings, voice: e.target.value})}
                className="w-full bg-slate-50 border-2 border-slate-300 rounded-xl p-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white cursor-pointer shadow-sm"
              >
                <optgroup label="👩 महिला आवाजें (Female / Ladies Voices)">
                  {AI_VOICES.filter(v => v.gender === 'female').map(v => (
                    <option key={v.id} value={v.id}>{v.label} — {v.desc}</option>
                  ))}
                </optgroup>
                <optgroup label="👨 पुरुष आवाजें (Male Voices)">
                  {AI_VOICES.filter(v => v.gender === 'male').map(v => (
                    <option key={v.id} value={v.id}>{v.label} — {v.desc}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Collapsible Speed & Audio Sliders */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-md overflow-hidden">
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="w-full px-4 py-3 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-800"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" /> Audio Speed & Pitch Controls
              </span>
              {showAdvancedSettings ? <ChevronUp className="w-4 h-4 text-slate-700" /> : <ChevronDown className="w-4 h-4 text-slate-700" />}
            </button>

            <AnimatePresence>
              {showAdvancedSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-5 border-t border-slate-200 bg-slate-50"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1"><FastForward className="w-3.5 h-3.5 text-indigo-600" /> Speed</span>
                        <span className="text-indigo-700 font-mono font-bold">{settings.speed}x</span>
                      </div>
                      <input 
                        type="range" min="0.5" max="2" step="0.1" value={settings.speed}
                        onChange={(e) => setSettings({...settings, speed: parseFloat(e.target.value)})}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1"><Music className="w-3.5 h-3.5 text-indigo-600" /> Pitch</span>
                        <span className="text-indigo-700 font-mono font-bold">{settings.pitch}x</span>
                      </div>
                      <input 
                        type="range" min="0.5" max="2" step="0.1" value={settings.pitch}
                        onChange={(e) => setSettings({...settings, pitch: parseFloat(e.target.value)})}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1"><Volume2 className="w-3.5 h-3.5 text-indigo-600" /> Volume</span>
                        <span className="text-indigo-700 font-mono font-bold">{settings.volume}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" value={settings.volume}
                        onChange={(e) => setSettings({...settings, volume: parseInt(e.target.value)})}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Bar */}
          <div id="action-bar" className="flex flex-wrap gap-3 items-center justify-between bg-white rounded-2xl p-4 border-2 border-slate-200 shadow-md">
            <div className="flex gap-2 w-full sm:w-auto">
              {!isSpeaking ? (
                <motion.button
                  id="speak-btn"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={speak}
                  className="flex-1 sm:flex-initial px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 transition-all text-base cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" /> Speak Voice
                </motion.button>
              ) : (
                <motion.button
                  id="stop-btn"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={stop}
                  className="flex-1 sm:flex-initial px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-red-600/30 transition-all text-base cursor-pointer"
                >
                  <Square className="w-5 h-5 fill-current" /> Stop
                </motion.button>
              )}
            </div>

            <motion.button
              id="export-btn"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isSynthesizing}
              onClick={generateDownload}
              className="w-full sm:w-auto px-5 py-3 bg-slate-900 hover:bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-md disabled:opacity-50 text-sm cursor-pointer"
            >
              {isSynthesizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download Audio
            </motion.button>
          </div>

          {/* Status Message */}
          <AnimatePresence>
            {status && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className={`p-3.5 rounded-xl flex items-center gap-3 font-bold text-xs md:text-sm border-2 ${
                  status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                  status.type === 'error' ? 'bg-red-50 text-red-800 border-red-300' :
                  'bg-indigo-50 text-indigo-900 border-indigo-300'
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${
                  status.type === 'success' ? 'bg-emerald-600 animate-pulse' :
                  status.type === 'error' ? 'bg-red-600' :
                  'bg-indigo-600 animate-pulse'
                }`} />
                {status.msg}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Clean Minimal Footer */}
        <footer className="mt-16 pt-6 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-600 text-xs">
          <div className="flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-indigo-600" />
            <span className="font-bold text-slate-700">Voicewala AI Studio</span>
          </div>
          <div className="font-mono text-[10px] font-bold text-slate-500">
            &copy; {new Date().getFullYear()} VOICEWALA SYSTEM
          </div>
        </footer>
      </main>
    </div>
  );
}
