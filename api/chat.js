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

const PRIMARY_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.5-flash-lite";
const MAX_RETRIES_PER_MODEL = 1;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableStatus(status) {
  return status === 500 || status === 502 || status === 503 || status === 504;
}

async function requestGemini(model, apiKey, contents, language) {
  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    model +
    ":generateContent?key=" +
    encodeURIComponent(apiKey);

  for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt++) {
    let response;
    let data;

    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT + "\n\nLANGUAGE PREFERENCE: " + language }]
          },
          contents,
          generationConfig: { maxOutputTokens: 1200 }
        })
      });

      data = await response.json().catch(() => ({}));
    } catch (error) {
      console.error("Gemini network error:", {
        model,
        attempt: attempt + 1,
        message: error && error.message ? error.message : "Unknown network error"
      });

      if (attempt < MAX_RETRIES_PER_MODEL) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      return { ok: false, status: 502, data: {} };
    }

    if (response.ok) return { ok: true, status: response.status, data };

    const providerError = data && data.error ? data.error : {};
    console.error("Gemini API error:", {
      model,
      attempt: attempt + 1,
      code: providerError.code || response.status,
      status: providerError.status || response.statusText,
      message: providerError.message || "No error message returned"
    });

    if (!isRetryableStatus(response.status) || attempt === MAX_RETRIES_PER_MODEL) {
      return { ok: false, status: response.status, data };
    }

    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? Math.min(retryAfterSeconds * 1000, 3000)
      : 500 * (attempt + 1);
    await sleep(delayMs);
  }

  return { ok: false, status: 502, data: {} };
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
      error: "Bongoboltu AI needs its Gemini API key configured on the server."
    });
  }

  try {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) {
      return res.status(400).json({ error: "Send a message first." });
    }

    const cleaned = messages.slice(-20).map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: String(message.content || "").slice(0, 6000) }]
    })).filter((message) => message.parts[0].text.trim());

    if (!cleaned.length || cleaned[cleaned.length - 1].role !== "user") {
      return res.status(400).json({ error: "The last message must be from the user." });
    }

    const latest = cleaned[cleaned.length - 1].parts[0].text.toLowerCase();
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
        : "Respond naturally in the language used by the user; Bangla and English are both supported. If the user mixes them, you may mix naturally.";

    let result = await requestGemini(PRIMARY_MODEL, apiKey, cleaned, language);
    let usedModel = PRIMARY_MODEL;

    // Only try the fallback when the primary model has a temporary availability failure.
    if (!result.ok && isRetryableStatus(result.status)) {
      console.warn("Primary Gemini model unavailable; trying fallback:", FALLBACK_MODEL);
      result = await requestGemini(FALLBACK_MODEL, apiKey, cleaned, language);
      usedModel = FALLBACK_MODEL;
    }

    if (!result.ok) {
      const providerError = result.data && result.data.error ? result.data.error : {};

      if (result.status === 429) {
        return res.status(429).json({
          error: "Gemini's request limit has been reached. Please wait a little and try again."
        });
      }

      if (result.status === 400) {
        return res.status(400).json({
          error: "Gemini could not process this message. Please try rephrasing it."
        });
      }

      if (result.status === 401 || result.status === 403) {
        console.error("Gemini authentication or permission failure:", {
          code: providerError.code || result.status,
          status: providerError.status || "",
          message: providerError.message || "No provider message"
        });
        return res.status(502).json({
          error: "Gemini rejected the server credentials or API permissions. Check the GEMINI_API_KEY environment variable."
        });
      }

      if (isRetryableStatus(result.status)) {
        return res.status(503).json({
          error: "Gemini is temporarily busy. Bongoboltu tried again, but the AI service is still unavailable. Please try again shortly."
        });
      }

      console.error("Gemini request failed:", {
        model: usedModel,
        code: providerError.code || result.status,
        status: providerError.status || "",
        message: providerError.message || "No provider message"
      });
      return res.status(502).json({
        error: "The AI provider could not complete the request. Please try again."
      });
    }

    const reply = result.data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      const finishReason = result.data.candidates?.[0]?.finishReason;
      console.error("Gemini returned no text:", { model: usedModel, finishReason });
      return res.status(502).json({
        error: "Gemini returned an empty response. Please try again."
      });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Bongoboltu API error:", error);
    return res.status(500).json({
      error: "Something went wrong while contacting the AI. Please try again."
    });
  }
};
