import { Handler } from "@netlify/functions";
import axios from "axios";

export const handler: Handler = async (event) => {
  const { text, lang } = event.queryStringParameters || {};

  if (!text) {
    return { statusCode: 400, body: "Text is required" };
  }

  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      text
    )}&tl=${lang || "hi"}&client=tw-ob`;

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "audio/mpeg" },
      body: Buffer.from(response.data).toString('base64'),
      isBase64Encoded: true
    };
  } catch (error) {
    return { statusCode: 500, body: "Error generating audio" };
  }
};
