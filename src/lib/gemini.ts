export async function rewriteText(text: string, mood: string, language: string) {
  try {
    const response = await fetch("/api/rewrite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, mood, lang: language }),
    });

    if (!response.ok) {
      throw new Error("Server rewrite failed");
    }

    const data = await response.json();
    return data.text || text;
  } catch (error) {
    console.error("AI Rewriting client proxy error:", error);
    return text;
  }
}

export async function generateScript(topic: string, category: string, language: string) {
  try {
    const response = await fetch("/api/generate-script", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ topic, category, lang: language }),
    });

    if (!response.ok) {
      throw new Error("Script generation failed");
    }

    const data = await response.json();
    return data.script || "";
  } catch (error) {
    console.error("AI Script generation client proxy error:", error);
    throw error;
  }
}

