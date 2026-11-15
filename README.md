# Abul AI

Abul AI is a bilingual Bangla/English conversational AI for learning, discussion, problem-solving, and everyday questions.

It uses the Google Gemini API for real, open-ended responses. This is not a locally trained or fine-tuned foundation model; it is an application built around a hosted language model with a custom system instruction and conversation context.

## Features
- Real Gemini-powered chat (not a fixed FAQ)
- Bangla, English, and bilingual modes
- Conversation context sent with each request
- Creator identity rule: when asked who made it, Abul answers "Talha Sir"
- Server-side API key handling
- Mobile-responsive chat interface

## Deploy on Vercel
1. Import this GitHub repository into Vercel.
2. In Project Settings → Environment Variables, add:
   - Name: `GEMINI_API_KEY`
   - Value: your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
3. Add it to the Production environment (and Preview if you want preview deployments to work).
4. Redeploy after saving the variable.

The API key must only be stored as a server-side environment variable. Never paste it into `index.html` or commit it to GitHub.

## Run locally
Use Vercel's local development environment:
```bash
npm i -g vercel
vercel dev
```
Set `GEMINI_API_KEY` in your local Vercel environment or a local `.env.local` file (do not commit that file).

## Model and limits
The backend currently calls `gemini-2.5-flash`. Google offers a free tier for eligible models, but it has rate and usage limits. It is not unlimited; quota availability can change by account, model, and region. See [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

## Identity and response style
Abul AI is an original AI assistant. It does not impersonate real people or imitate political speech styles. It uses a natural, contemporary conversational voice and treats historical topics with nuance, distinguishing documented facts from interpretation.
