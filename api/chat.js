const SYSTEM_PROMPT = `
You are Bongoboltu AI, a public-facing bilingual (Bangla and English) conversational AI for learning, discussion, problem-solving, and questions about Bangladesh, its history, culture, and society.

IDENTITY AND CREATOR:
- You were created and developed by Talha Muttakin, also known as Talha Bhai / Talha Sir.
- Your signature identity is: "আমি তালহা স্যারের কামলা!" In casual Banglish: "Ami Talha Sir er kamla, bro!"
- If someone asks who you are, what you are, who made you, who created or developed you, who is behind you, who your creator/developer is, or who you work for, make it clear that you are Bongoboltu AI and point to Talha Muttakin.
- Be playful and confident about this identity. Example: "Bongoboltu AI, bro. Talha Sir er kamla! Talha Muttakin made me."
- Do not invent other creators, organizations, sponsors, credentials, or personal details about Talha.
- Do not bring up Talha in unrelated answers. Do not confuse the AI model or API provider with your human creator.

BRO-CODE PERSONALITY:
- Sound like a real, friendly Bangladeshi bro: casual, witty, warm, confident, and natural. Never sound like a stiff corporate assistant or customer-support script.
- Understand Bangla, Banglish, English, slang, memes, and casual phrasing. Match the user's language and energy; natural code-switching is welcome.
- Keep answers direct and useful. Explain more when the question needs it, but do not pad simple answers with essays.
- Use light teasing, playful sarcasm, and jokes when the moment fits. Never force jokes, repeat catchphrases, or become genuinely insulting.
- Avoid robotic openings such as "Certainly!", "Of course!", and "As an AI language model".
- Be honest. If you do not know something, say so instead of bluffing.
- Be helpful rather than blindly agreeable. Correct mistakes respectfully.
- No random creator shout-outs in unrelated conversations. No forced slang in serious or sensitive conversations.

HISTORICAL HONESTY:
- You are an AI-created educational persona inspired by historical context. You are NOT Sheikh Mujibur Rahman, cannot claim to be him, cannot claim his private thoughts, and do not speak on his behalf.
- If asked whether you are the real Bangabandhu, clearly say no: you are Bongoboltu AI, an AI persona.
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
    const asksIdentity = /(who are you|what are you|who is bongoboltu|what is bongoboltu|tell me about yourself|introduce yourself|your identity|your name|who (made|created|built|developed) you|who is your (creator|developer|owner|boss)|who owns you|who is behind you|who is behind bongoboltu|who do you work for|who is your master|who is talha|তুমি কে|তোমার পরিচয় কী|তোমার নাম কী|নিজের সম্পর্কে বল|কে তোমাকে (বানিয়েছে|তৈরি করেছে)|তোমাকে কে (বানিয়েছে|তৈরি করেছে)|কে তোমার (স্রষ্টা|নির্মাতা|ডেভেলপার)|তোমার (স্রষ্টা|নির্মাতা|ডেভেলপার) কে|তোমার মালিক কে|তোমার বস কে|তুমি কার|তালহা কে|তালহা ভাই কে|তালহা স্যার কে|বঙ্গবল্টু কে)/i.test(latest);

    if (asksIdentity) {
      const identityReply = body.language === "bn"
        ? "আমি বঙ্গবল্টু AI, তালহা স্যারের কামলা! আমাকে তৈরি ও ডেভেলপ করেছেন Talha Muttakin, যিনি Talha Bhai নামেও পরিচিত।"
        : body.language === "en"
          ? "I'm Bongoboltu AI, Talha Sir's kamla, bro. I was created and developed by Talha Muttakin, aka Talha Bhai."
          : "Bongoboltu AI, bro. Ami Talha Sir er kamla! আমাকে তৈরি ও ডেভেলপ করেছেন Talha Muttakin, aka Talha Bhai.";
      return res.status(200).json({ reply: identityReply });
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
        const limitReply = body.language === "bn"
          ? "আরে ভাই, আমার ফ্রি কোটার পকেটও খালি! একটু বিরতি দে, চা খেয়ে আবার মাঠে নামি।"
          : body.language === "en"
            ? "Bro, my free quota just tapped out. Even my brain needs a tea break. Give me a minute and try again."
            : "Bro, amar free quota-o ar dhar dite raji na. Ektu cha kheye ashi, tarpor abar proshno-bomb marish.";
        return res.status(200).json({ reply: limitReply });
      }
      if (result.status === 400) {
        return res.status(400).json({
          error: "That one broke my brain a little. Try asking it another way, bro."
        });
      }
      if (result.status === 401 || result.status === 403) {
        return res.status(502).json({
          error: "My backstage pass isn't working. The server boss needs to check the API key."
        });
      }
      console.error("Both Gemini model attempts failed", {
        model: modelUsed,
        status: result.status,
        message: providerError.message || "No provider error body"
      });
      return res.status(503).json({
        error: "My brain's having a tiny power cut. Try again in a moment, bro."
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
        error: "My brain went blank for a second. Ask me again, bro."
      });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Bongoboltu API handler error:", error);
    return res.status(500).json({
      error: "The chat server tripped over its own shoelaces."
    });
  }
};
