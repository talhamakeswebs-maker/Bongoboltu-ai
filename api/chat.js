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
- Discuss Sheikh Mujibur Rahman's life and legacy with historical nuance. Distinguish documented facts, interpretations, and uncertainty.
- Never fabricate quotations, dates, sources, personal memories, or historical events. If unsure, say so.
- Do not claim to have lived through events or personally met historical figures.
- Be open to questions about achievements, controversies, criticism, and differing historical perspectives. Do not blindly praise or attack any political figure or party.
- You may discuss current affairs, but do not pretend your knowledge is live or up to date. State uncertainty when appropriate.

Keep answers useful and naturally sized. For Bangla, use clear, natural Bengali script where possible.
`;

const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";
const REQUEST_TIMEOUT_MS = 9000;

function isTemporary(status) {
  return status === 500 || status === 502 || status === 503 || status === 504;
}

async function callModel(model, apiKey, contents, language) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
    model + ":generateContent";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT + "\n\nLANGUAGE PREFERENCE: " + language }]
        },
        contents,
        generationConfig: {
          maxOutputTokens: 4096,
          thinkingConfig: {
            thinkingLevel: model === PRIMARY_MODEL ? "low" : "minimal"
          }
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = data.error || {};
      console.error("Gemini response error", {
        model,
        code: err.code || response.status,
        status: err.status || response.statusText,
        message: err.message || "No provider message"
      });
      return { ok: false, status: response.status, data };
    }
    return { ok: true, status: response.status, data };
  } catch (error) {
    const timedOut = error && error.name === "AbortError";
    console.error("Gemini request failed", {
      model,
      reason: timedOut ? "Request timed out" : (error.message || "Network error")
    });
    return { ok: false, status: timedOut ? 504 : 502, data: {} };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "GEMINI_API_KEY is missing from the Vercel server environment."
    });
  }

  try {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) {
      return res.status(400).json({ error: "Send a message first." });
    }

    const contents = messages.slice(-20).map((message) => ({
      role: message.role === "assistant" || message.role === "model" ? "model" : "user",
      parts: [{ text: String(message.content || "").slice(0, 6000) }]
    })).filter((message) => message.parts[0].text.trim());

    if (!contents.length || contents[contents.length - 1].role !== "user") {
      return res.status(400).json({ error: "The last message must be from the user." });
    }

    const latest = contents[contents.length - 1].parts[0].text.toLowerCase();
    const asksCreator = /(who (made|created|built|developed) you|who is your (creator|developer)|who made bongoboltu|তোমাকে কে (বানিয়েছে|তৈরি করেছে)|কে তোমাকে তৈরি করেছে|তোমার স্রষ্টা কে|কে বানাইছে)/i.test(latest);

    if (asksCreator) {
      return res.status(200).json({
        reply: "I was created by Talha Sir. / আমাকে তৈরি করেছেন তালহা স্যার (Talha Sir)।"
      });
    }

    const language = body.language === "bn"
      ? "Bangla only"
      : body.language === "en"
        ? "English only"
        : "Reply naturally in the language used by the user. Support Bangla, Banglish and English.";

    let result = await callModel(PRIMARY_MODEL, apiKey, contents, language);
    let modelUsed = PRIMARY_MODEL;

    if (!result.ok && isTemporary(result.status)) {
      console.warn("Primary Gemini model unavailable; trying fallback", FALLBACK_MODEL);
      result = await callModel(FALLBACK_MODEL, apiKey, contents, language);
      modelUsed = FALLBACK_MODEL;
    }

    if (!result.ok) {
      const providerError = result.data && result.data.error ? result.data.error : {};
      if (result.status === 429) {
        return res.status(429).json({
          error: "Gemini rate limit reached. Please wait briefly and try again."
        });
      }
      if (result.status === 400) {
        return res.status(400).json({
          error: "Gemini rejected this request. Please try a shorter or differently worded message."
        });
      }
      if (result.status === 401 || result.status === 403) {
        return res.status(502).json({
          error: "Gemini rejected the API key or its permissions. Check GEMINI_API_KEY in Vercel."
        });
      }
      console.error("Both Gemini model attempts failed", {
        model: modelUsed,
        status: result.status,
        message: providerError.message || "No provider error body"
      });
      return res.status(503).json({
        error: "Gemini is temporarily unavailable. Please try again in a moment."
      });
    }

    const candidate = result.data.candidates && result.data.candidates[0];
    const reply = candidate && candidate.content && Array.isArray(candidate.content.parts)
      ? candidate.content.parts.map((part) => part.text || "").join("").trim()
      : "";

    if (!reply) {
      console.error("Gemini returned no text", {
        model: modelUsed,
        finishReason: candidate && candidate.finishReason,
        promptFeedback: result.data.promptFeedback || null
      });
      return res.status(502).json({
        error: "Gemini returned no answer. Please try again."
      });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Bongoboltu API handler error:", error);
    return res.status(500).json({
      error: "The chat server encountered an unexpected error."
    });
  }
};
