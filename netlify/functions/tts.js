import axios from 'axios';

async function generateAudio(text, lang = 'hi') {
  const langCode = (lang || 'hi').split('-')[0] || 'hi';
  const maxLen = 180;
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Empty text');

  const chunks = [];
  let remaining = trimmed;

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

  const voiceName = langCode === 'hi' ? 'Aditi' :
                    langCode === 'ta' ? 'Valluvar' :
                    langCode === 'fr' ? 'Mathieu' :
                    langCode === 'es' ? 'Conchita' :
                    langCode === 'de' ? 'Hans' : 'Brian';

  const fetchChunk = async (chunk) => {
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
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 7000
        });
        const buf = Buffer.from(response.data);
        if (buf && buf.length > 100) {
          return buf;
        }
      } catch (e) {
        // continue to next provider
      }
    }
    return Buffer.alloc(0);
  };

  const BATCH_SIZE = 4;
  const mp3Buffers = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((c) => fetchChunk(c)));
    mp3Buffers.push(...batchResults);
  }

  const validBuffers = mp3Buffers.filter((b) => b && b.length > 100);

  if (validBuffers.length === 0) {
    throw new Error('Failed to fetch audio stream');
  }

  return Buffer.concat(validBuffers);
}

export async function handler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  let text = '';
  let lang = 'hi';

  try {
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      text = body.text || '';
      lang = body.lang || 'hi';
    } else {
      text = event.queryStringParameters?.text || '';
      lang = event.queryStringParameters?.lang || 'hi';
    }

    if (!text || !text.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Text parameter is required' })
      };
    }

    const audioBuffer = await generateAudio(text, lang);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400'
      },
      body: audioBuffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    console.error('Netlify Function TTS Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message || 'Failed to generate TTS' })
    };
  }
}
