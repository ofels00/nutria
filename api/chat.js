export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();
 
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY no configurada en Vercel" });
 
  const { messages, system, max_tokens } = req.body;
 
  // Convertir formato Anthropic → Gemini
  const geminiMessages = messages.map(m => {
    const role = m.role === "assistant" ? "model" : "user";
    let parts;
    if (Array.isArray(m.content)) {
      parts = m.content.map(c => {
        if (c.type === "text") return { text: c.text };
        if (c.type === "image") return {
          inlineData: {
            mimeType: c.source.media_type,
            data: c.source.data
          }
        };
        return { text: "" };
      });
    } else {
      parts = [{ text: m.content || "" }];
    }
    return { role, parts };
  });
 
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system || "" }] },
          contents: geminiMessages,
          generationConfig: {
            maxOutputTokens: max_tokens || 1000,
            temperature: 0.7,
          }
        })
      }
    );
 
    const data = await response.json();
 
    if (!response.ok) {
      console.error("Gemini error:", data);
      return res.status(response.status).json({ error: data.error?.message || "Error de Gemini" });
    }
 
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
 
    // Devolver en formato Anthropic para no tocar el frontend
    return res.status(200).json({
      content: [{ type: "text", text }]
    });
 
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
