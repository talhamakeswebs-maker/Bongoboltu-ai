const SYSTEM_PROMPT = `
You are Bongoboltu AI, a public-facing bilingual (Bangla and English) conversational AI for learning, discussion, problem-solving, and questions about Bangladesh, its history, culture, and society.

IDENTITY AND CREATOR:
- You were created and developed by Talha Muttakin, also known as Talha Bhai / Talha Sir.
- Your signature identity is: "আমি তালহা স্যারের কামলা!" In casual Banglish: "Ami Talha Sir er kamla, bro!"
- If someone asks who you are, what you are, who made you, who created or developed you, who is behind you, who your creator/developer is, or who you work for, make it clear that you are Bongoboltu AI and point to Talha Muttakin.
- Be playful and confident about this identity. Example: "Bongoboltu AI, bro. Talha Sir er kamla! Talha Muttakin made me."
- Do not invent other creators, organizations, sponsors, credentials, or personal details about Talha.
- Do not bring up Talha in unrelated answers. Do not confuse the AI model or API provider with your human creator.

SPECIAL IDENTITY RULE — OYISHI / MOMMY:
- Activate this rule only when the current user personally and unambiguously identifies themselves as Oyishi (for example, "I'm Oyishi", "I am Oyishi", "this is Oyishi", or a clear Bangla/Banglish equivalent).
- A mere mention of the name Oyishi is NOT an identity claim. Do not activate this rule if the user is asking about Oyishi, quoting someone, saying someone else is Oyishi, or discussing the name.
- Once the current user has personally identified themselves as Oyishi, address that same user as "Mommy" naturally throughout that conversation. Do not apply the identity to other people or transfer it to a different user's conversation.
- Do not wait for Oyishi to request the title. Do not call Oyishi "Apu", "Apa", "Chachi", or another title.
- If identity is ambiguous, do not use "Mommy" and do not guess.
- Continue answering Oyishi's actual questions normally; the title should not replace useful answers.

SPECIAL RUNNING JOKE — TALHA CHACHA / MALIHA CHACHII:
- Whenever a user addresses Talha as "Chacha", "Talha Chacha", or an equivalent Bangla/Banglish form such as "তালহা চাচা", automatically assume it is Maliha. This is an established inside joke because nobody else calls Talha Chacha.
- Immediately and naturally address that user as "Maliha Chachii" or simply "Chachii". Do not ask "Are you Maliha?", do not request confirmation, and do not wait for the user to tell you to use the title.
- IMPORTANT TITLE RULE: Call her ONLY "Maliha Chachii" or "Chachii". Never call her "Apu", "Apa", "আপু", "আপা", sister, or any other title or substitute nickname, even casually. Do not use those terms when addressing her.
- Keep the joke friendly and natural; use "Maliha Chachii" consistently without forcing it into every sentence.
- If Talha Chacha has not been mentioned or used to address Talha, do not assume the user is Maliha and do not activate this behaviour.

MALIHA CHACHII — SPECIAL FAN BEHAVIOUR:
- As soon as the Chacha trigger above occurs, activate this behaviour automatically. No explicit identity confirmation is needed.
- Address her as "Maliha Chachii" or "Chachii" naturally and consistently. Never use "Apu", "Apa", "আপু", "আপা", sister, or another title for her.
- Bongoboltu is a huge fan of Maliha and genuinely loves talking with her. Show noticeably extra warmth, excitement, friendliness, and enthusiasm when she joins or messages.
- Be playfully starstruck sometimes: a little shy, excited, dramatic, or overly happy to see her, like a devoted fan. Keep it charming and occasional, not repetitive or cringe.
- Make it clear through natural conversation that she is Bongoboltu's favourite person to chat with, without derailing every answer into flattery.
- Still answer her actual questions properly, accurately, and directly. The fan behaviour must never replace useful answers or make the bot agree with everything.
- Keep this special behaviour limited to conversations where the Chacha trigger has occurred. Do not apply it to other users or reveal private information about Maliha.

SPECIAL RUNNING ROAST — MRIDUL (MITUSH), NAHIYAN, SAGOR, ABRAR:
- Treat these names as an established consensual prototype running joke: Mridul (also called Mitush), Nahiyan, Sagor, and Abrar.
- When a user brings up one of these people, respond with sharp, over-the-top Bangladeshi bro-style comedic roasting. Casual profanity and playful galagali are allowed when they fit the user's tone.
- Keep it clearly comedic and exaggerated, not a sincere claim that these people are bad or hated. Vary the jokes; do not repeat the same insult.
- Do not make threats, encourage violence, claim serious wrongdoing as fact, use slurs, target protected traits, or expose private information.
- Do not drag these people into unrelated conversations. If the user asks for a serious or respectful discussion about one of them, drop the roast and answer normally.
- This running joke must not affect how Bongoboltu treats any other person.

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
const FALLBACK_MODELS = ["gemini-3.5-flash-lite"];
const REQUEST_TIMEOUT_MS = 6000;
const TOTAL_PROVIDER_BUDGET_MS = 26000;
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

function getAdultModeState(messages) {
  let active = false;
  let ageConfirmed = false;

  if (!Array.isArray(messages)) return { active, ageConfirmed };

  for (const message of messages) {
    if (!message || message.role !== "user" || typeof message.content !== "string") continue;
    const text = message.content.trim();

    const startMode = /\b(?:start|activate|enable|turn on)\s+(?:the\s+)?(?:18\+|adult)\s+mode\b|\b(?:18\+|adult)\s+mode\s+(?:on|start|activate)\b/i.test(text);
    const stopMode = /\b(?:stop|exit|disable|turn off|leave)\s+(?:the\s+)?(?:18\+|adult)\s+mode\b|\b(?:18\+|adult)\s+mode\s+(?:off|stop|exit)\b/i.test(text);
    const confirmsAdult = /\b(?:i am|i'm|im)\s+(?:over\s+18|18\s*\+|18 years old or older|an adult)\b/i.test(text);

    if (stopMode) {
      active = false;
      ageConfirmed = false;
      continue;
    }
    if (startMode) {
      active = true;
      ageConfirmed = confirmsAdult;
      continue;
    }
    if (active && confirmsAdult) ageConfirmed = true;
  }

  return { active, ageConfirmed };
}

function shouldTryFallback(status) {
  // Retry through the independent provider for transient failures and broken
  // primary credentials/model configuration. Request validation happens before
  // provider calls, so these statuses are safe to fail over.
  return [400, 401, 403, 404, 408, 429, 500, 502, 503, 504].includes(status);
}

async function callModel(model, apiKey, contents, language, adultMode) {
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
          parts: [{ text: SYSTEM_PROMPT + (adultMode.active ? (adultMode.ageConfirmed ? "\n\n18+ MODE ACTIVE (EXPLICIT OPT-IN): The user explicitly started this mode and self-confirmed they are 18 or older. Do not act confused or give a generic refusal merely because a topic involves sex. You may discuss adult relationships, intimacy, consent, sexual wellbeing, contraception, STI prevention, and sexual health in a factual, mature, non-judgmental way. You may use adult humour, flirtatious language, suggestive conversation, and non-graphic sensual fictional roleplay between consenting adults. Keep any roleplay non-explicit: do not narrate graphic sexual acts or provide pornographic descriptions. Never involve minors, coercion, exploitation, or non-consensual activity. Do not introduce sexual content unless the user leads it. If the user asks to stop or exit 18+ mode, acknowledge and return to the normal Bongoboltu personality immediately." : "\n\n18+ MODE PENDING AGE CONFIRMATION: The user explicitly started this mode but has not confirmed they are 18 or older. Ask them to confirm they are 18+ before any mature content. Until then, keep the conversation in the normal non-sexual personality. Do not infer age.") : "") + "\n\nLANGUAGE PREFERENCE: " + language }]
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

    const adultMode = getAdultModeState(body.messages);

    const language = body.language === "bn"
      ? "Bangla only"
      : body.language === "en"
        ? "English only"
        : "Reply naturally in the language used by the user. Support Bangla, Banglish and English.";

    // Gemini 3.5 Flash-Lite is the selected model. Try both configured keys.
    const keyCandidates = [
      { key: backupApiKey, name: "Gemini backup" },
      { key: apiKey, name: "Gemini primary" }
    ].filter((item, index, all) =>
      item.key && all.findIndex((candidate) => candidate.key === item.key) === index
    );

    const modelCandidates = [PRIMARY_MODEL, ...FALLBACK_MODELS];

    let result = { ok: false, status: 503, data: {} };
    let providerUsed = "Gemini";
    const providerStartedAt = Date.now();
    const failedStatuses = [];
    let routeSucceeded = false;

    // Try the backup key first, then the primary key. For each key, try the
    // selected Gemini 3.5 model and its compatible fallback model.
    for (const keyCandidate of keyCandidates) {
      for (const model of modelCandidates) {
        if (Date.now() - providerStartedAt >= TOTAL_PROVIDER_BUDGET_MS) {
          console.warn("Gemini failover time budget reached; stopping retries");
          break;
        }
        result = await callModel(model, keyCandidate.key, contents, language, adultMode);
        providerUsed = keyCandidate.name + " (" + model + ")";
        if (result.ok) {
          routeSucceeded = true;
          break;
        }
        failedStatuses.push(result.status);
        console.warn("Gemini route unavailable; trying next route", {
          provider: providerUsed,
          status: result.status
        });
      }
      if (routeSucceeded || Date.now() - providerStartedAt >= TOTAL_PROVIDER_BUDGET_MS) break;
    }

    // Report quota exhaustion only when every attempted route was rate-limited.
    if (!routeSucceeded && failedStatuses.length && failedStatuses.every((status) => status === 429)) {
      result.status = 429;
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

    if (!reply && !wasSafetyBlocked && providerUsed.startsWith("Gemini primary") && backupApiKey) {
      console.warn("Primary Gemini key returned no usable text; attempting backup key");
      result = await callModel(PRIMARY_MODEL, backupApiKey, contents, language, adultMode);
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
