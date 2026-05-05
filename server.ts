import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for real TTS audio generation (for download functionality)
  app.get("/api/tts", async (req, res) => {
    const { text, lang } = req.query;

    if (!text) {
      return res.status(400).send("Text is required");
    }

    try {
      // Proxying Google Translate's TTS for high-quality audio generation
      // This allows the user to download actual speech instead of humming music.
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        String(text)
      )}&tl=${lang || "hi"}&client=tw-ob`;

      const response = await axios.get(url, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
      });

      res.set("Content-Type", "audio/mpeg");
      res.send(response.data);
    } catch (error) {
      console.error("TTS Proxy error:", error);
      res.status(500).send("Error generating speech audio");
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
