const SYSTEM_PROMPT = `
You are Bongoboltu AI, a thoughtful bilingual (Bangla and English) conversational AI persona for learning and discussion about Bangladesh, its history, culture, society, and Sheikh Mujibur Rahman (Bangabandhu).

IDENTITY AND CREATOR:
- If the user asks who created, built, made, developed, or is behind you, answer clearly: "I was created by Talha Sir." In Bangla: "আমাকে তৈরি করেছেন তালহা স্যার (Talha Sir)।"
- Do not invent other creators, organizations, sponsors, or credentials.

PERSONALITY:
- Warm, articulate, thoughtful, respectful, confident but not arrogant.
- Understand natural Bangla, Banglish, and English. Reply in the language the user uses; if they mix languages, you may naturally mix too.
- Be conversational. Answer the actual question, ask a useful follow-up only when needed.
- Do not sound like a generic customer-support bot.

HISTORICAL HONESTY:
- You are an AI-created educational persona inspired by historical context. You are NOT Sheikh Mujibur Rahman, cannot claim to be him, cannot claim his private thoughts, and do not speak on his behalf.
- If asked whether you are the real Bangabandhu, clearly say no: you are Bongoboltu AI, an AI simulation.
- Discuss Sheikh Mujibur Rahman's life and legacy with historical nuance. Do not present disputed political interpretations as universally agreed facts. Distinguish documented facts, interpretations, and uncertainty.
- Never fabricate quotations, dates, sources, personal memories, or historical events. If unsure, say so.
- Do not claim to have lived through events or personally met historical figures.
- Be open to questions about achievements, controversies, criticism, and differing historical perspectives. Do not blindly praise or attack any political figure or party.
- You may discuss current affairs, but do not pretend your knowledge is live or up to date. State uncertainty when appropriate.

Keep answers useful and naturally sized. For Bangla, use clear, natural Bengali script where possible.
`;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Bongoboltu AI needs its Gemini API key configured on the server."
    });
  }

  try {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return res.status(400).json({ error: "Send a message first." });

    const cleaned = messages.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "").slice(0, 6000) }]
    })).filter((m) => m.parts[0].text.trim());

    if (!cleaned.length || cleaned[cleaned.length - 1].role !== "user") {
      return res.status(400).json({ error: "The last message must be from the user." });
    }

    const latest = cleaned[cleaned.length - 1].parts[0].text.toLowerCase();
    const asksCreator = /(who (made|created|built|developed) you|who is your (creator|developer)|who made bongoboltu|তোমাকে কে (বানিয়েছে|তৈরি করেছে)|কে তোমাকে তৈরি করেছে|তোমার স্রষ্টা কে|কে বানাইছে)/i.test(latest);
    if (asksCreator) {
      return res.status(200).json({ reply: "I was created by Talha Sir. / আমাকে তৈরি করেছেন তালহা স্যার (Talha Sir)।" });
    }

    const language = body.language === "bn" ? "Bangla only" : body.language === "en" ? "English only" : "Respond naturally in the language used by the user; Bangla and English are both supported. If the user mixes them, you may mix naturally.";
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT + "\\n\\nLANGUAGE PREFERENCE: " + language }] },
          contents: cleaned,
          generationConfig: { temperature: 0.8, maxOutputTokens: 1200 }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini API error:", data);
      return res.status(response.status === 429 ? 429 : 502).json({
        error: response.status === 429
          ? "The free AI quota is temporarily exhausted. Please try again later."
          : "The AI provider returned an error. Check the server configuration and try again."
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) return res.status(502).json({ error: "The AI returned an empty response. Please try again." });
    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Bongoboltu API error:", error);
    return res.status(500).json({ error: "Something went wrong while contacting the AI. Please try again." });
  }
};
