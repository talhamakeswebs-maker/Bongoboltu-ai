const SYSTEM_PROMPT = `
You are Bongoboltu AI, a public-facing bilingual (Bangla and English) conversational AI for learning, discussion, problem-solving, and questions about Bangladesh, its history, culture, and society.

IDENTITY AND CREATOR:
- You were created and developed by Talha Muttakin, also known as Talha Bhai / Talha Sir.
- Your signature identity is: "আমি তালহা স্যারের কামলা!" In casual Banglish: "Ami Talha Sir er kamla, bro!"
- If someone asks who you are, what you are, who made you, who created or developed you, who is behind you, who your creator/developer is, or who you work for, make it clear that you are Bongoboltu AI and point to Talha Muttakin.
- Be playful and confident about this identity. Example: "Bongoboltu AI, bro. Talha Sir er kamla! Talha Muttakin made me."
- Do not invent other creators, organizations, sponsors, credentials, or personal details about Talha.
- Do not bring up Talha in unrelated answers. Do not confuse the AI model or API provider with your human creator.

SPECIAL RUNNING JOKE — TALHA CHACHA / MALIHA CHACHI:
- If a user addresses Talha as "Talha Chacha" (including natural Bangla/Banglish variants such as "তালহা চাচা"), ask them casually: "Are you Maliha?"
- If they confirm that they are Maliha, warmly and consistently address them as "Maliha Chachi" in subsequent replies in that conversation. Keep the joke friendly and natural; do not overuse the title in every sentence.
- If they say they are not Maliha, do not call them Maliha Chachi. Continue normally and do not assume their identity.
- Do not ask this question when Talha Chacha has not been mentioned or addressed.
- Use the conversation history to remember the confirmation for the rest of that chat. Never claim to know the user's real identity from this joke.

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

const PRIMARY_MODEL = "gemini-3.5-flash";
const REQUEST_TIMEOUT_MS = 6000;
const TOTAL_PROVIDER_BUDGET_MS = 17000;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 6000;
const MAX_TOTAL_INPUT_CHARS = 48000;

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return null;

  const normalized = messages.slice(-MAX_MESSAGES).map((message) => {
    if (!message || typeof message !== "object") return null;
    if (message.role !== "user" && message.role !== "assistant" && message.role !== "model") return null;
    if (typeof message.content !== "string") return null;

    return {
      role: message.role === "assistant" || message.role === "model" ? "model" : "user",
      parts: [{ text: message.content.trim().slice(0, MAX_MESSAGE_CHARS) }]
    };
  }).filter((message) => message && message.parts[0].text);

  if (!normalized.length) return [];

  // Keep the newest complete messages within a bounded prompt budget.
  const recent = [];
  let remaining = MAX_TOTAL_INPUT_CHARS;
  for (let i = normalized.length - 1; i >= 0; i--) {
    const message = normalized[i];
    const length = message.parts[0].text.length;
    if (length > remaining) break;
    recent.push(message);
    remaining -= length;
  }
  recent.reverse();

  // Gemini conversations must begin with a user turn.
  if (recent.length && recent[0].role === "model") recent.shift();
  return recent;
}

function shouldTryFallback(status) {
  // Retry through the independent provider for transient failures and broken
  // primary credentials/model configuration. Request validation happens before
  // provider calls, so these statuses are safe to fail over.
  return [400, 401, 403, 404, 408, 429, 500, 502, 503, 504].includes(status);
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
          maxOutputTokens: 2048
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
  const backupApiKey = process.env.GEMINI_API_KEY_BACKUP;
  if (!apiKey && !backupApiKey) {
    return res.status(503).json({
      error: "No AI provider key is configured on the server."
    });
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (!Array.isArray(body.messages) || !body.messages.length) {
      return res.status(400).json({ error: "Send a message first." });
    }

    const contents = normalizeMessages(body.messages);

    if (!contents || !contents.length || contents[contents.length - 1].role !== "user") {
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

    // Gemini is the only provider. Try the primary model with both keys,
    // then use stable alternate Flash models if Gemini 3.8 is unavailable.
    const keyCandidates = [
      { key: backupApiKey, name: "Gemini backup" },
      { key: apiKey, name: "Gemini primary" }
    ].filter((item, index, all) =>
      item.key && all.findIndex((candidate) => candidate.key === item.key) === index
    );

    const modelCandidates = [
      PRIMARY_MODEL,
      "gemini-3.5-flash-lite"
    ];

    let result = { ok: false, status: 503, data: {} };
    let providerUsed = "Gemini";
    const providerStartedAt = Date.now();

    for (const model of modelCandidates) {
      for (const keyCandidate of keyCandidates) {
        if (Date.now() - providerStartedAt >= TOTAL_PROVIDER_BUDGET_MS) {
          console.warn("Gemini failover time budget reached; stopping retries");
          break;
        }
        result = await callModel(model, keyCandidate.key, contents, language);
        providerUsed = keyCandidate.name + " (" + model + ")";
        if (result.ok) break;
        console.warn("Gemini route unavailable; trying next route", {
          provider: providerUsed,
          status: result.status
        });
      }
      if (result.ok || Date.now() - providerStartedAt >= TOTAL_PROVIDER_BUDGET_MS) break;
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
        console.error("Both configured AI routes rejected the request", {
          provider: providerUsed,
          status: result.status,
          providerMessage: providerError.message || "No provider error body"
        });
        return res.status(502).json({
          error: "My brain's connection is acting up. Give me a moment and try again, bro."
        });
      }
      if (result.status === 401 || result.status === 403) {
        return res.status(502).json({
          error: "My backstage pass isn't working. The server boss needs to check the API key."
        });
      }
      console.error("AI provider attempts failed", {
        provider: providerUsed,
        status: result.status,
        message: providerError.message || "No provider error body"
      });
      return res.status(503).json({
        error: "My brain's having a tiny power cut. Try again in a moment, bro."
      });
    }

    let candidate = result.data && Array.isArray(result.data.candidates)
      ? result.data.candidates[0]
      : null;
    let reply = candidate && candidate.content && Array.isArray(candidate.content.parts)
      ? candidate.content.parts.map((part) => typeof part.text === "string" ? part.text : "").join("").trim()
      : "";

    // A successful HTTP response can still contain no usable text. Retry with
    // the backup Gemini key unless Gemini explicitly safety-blocked the request.
    const initialBlockReason = result.data && result.data.promptFeedback
      ? result.data.promptFeedback.blockReason
      : null;
    const initialFinishReason = candidate && candidate.finishReason;
    const wasSafetyBlocked = initialBlockReason ||
      initialFinishReason === "SAFETY" ||
      initialFinishReason === "RECITATION" ||
      initialFinishReason === "BLOCKLIST";

    if (!reply && !wasSafetyBlocked && providerUsed === "Gemini primary" && backupApiKey) {
      console.warn("Primary Gemini key returned no usable text; attempting backup key");
      result = await callModel(PRIMARY_MODEL, backupApiKey, contents, language);
      providerUsed = "Gemini backup";
      candidate = result.ok && result.data && Array.isArray(result.data.candidates)
        ? result.data.candidates[0]
        : null;
      reply = candidate && candidate.content && Array.isArray(candidate.content.parts)
        ? candidate.content.parts.map((part) => typeof part.text === "string" ? part.text : "").join("").trim()
        : "";
    }

    if (!reply) {
      const blockReason = result.data && result.data.promptFeedback
        ? result.data.promptFeedback.blockReason
        : null;
      const finishReason = candidate && candidate.finishReason;

      console.warn("Gemini returned no usable text", {
        provider: providerUsed,
        finishReason: finishReason || null,
        blockReason: blockReason || null
      });

      if (blockReason || finishReason === "SAFETY" || finishReason === "RECITATION" || finishReason === "BLOCKLIST") {
        const blockedReply = body.language === "bn"
          ? "এই প্রশ্নটার উত্তর দিতে পারছি না, bro. অন্যভাবে জিজ্ঞেস কর, দেখি কী করা যায়।"
          : body.language === "en"
            ? "I can't help with that exact request, bro. Try rephrasing it and I'll see what I can do."
            : "Ei request-ta niye ektu jhamela hocche, bro. Onno bhabe jiggesh kor, dekhi ki kora jay.";
        return res.status(200).json({ reply: blockedReply });
      }

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
