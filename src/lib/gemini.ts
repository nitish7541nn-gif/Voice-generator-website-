import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function rewriteText(text: string, mood: string, language: string) {
  if (!process.env.GEMINI_API_KEY) {
    return text;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Rewrite the following text to sound strictly ${mood} in ${language}. 
      Keep it concise and expressive. Do not add any conversational meta-text, just the rewritten content.
      
      Text: "${text}"`,
    });
    
    return response.text?.trim() || text;
  } catch (error) {
    console.error("AI Rewriting error:", error);
    return text;
  }
}
