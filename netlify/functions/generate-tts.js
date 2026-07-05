import { handler as ttsHandler } from './tts.js';

export async function handler(event, context) {
  return ttsHandler(event, context);
}
