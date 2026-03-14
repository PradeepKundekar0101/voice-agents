# VoxAI - AI Voice Agent Studio

A full-stack demo application for creating and interacting with AI voice agents. Built with Next.js, powered by OpenRouter for AI, with JWT-based authentication.

## Features

- **JWT Authentication** — Register/login with secure httpOnly cookie-based sessions
- **Voice Agent Management** — Create custom agents with configurable system prompts
- **Real-time Voice Chat** — Talk to your AI agents using browser speech recognition
- **Text-to-Speech** — AI responses are spoken aloud via browser speech synthesis
- **Text Mode** — Fall back to typed chat when voice isn't available
- **Preset Agents** — Quick-start templates (assistant, tech support, language tutor, interview coach)

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4
- **Auth**: JWT via `jose`, password hashing with `bcryptjs`
- **AI**: OpenRouter API (default model: LLaMA 4 Maverick)
- **Voice**: Web Speech API (SpeechRecognition + SpeechSynthesis)
- **Storage**: File-based JSON (demo purposes)

## Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Configure environment variables:**

   Copy `.env.example` to `.env.local` and add your OpenRouter API key:

   ```bash
   cp .env.example .env.local
   ```

   Get a free API key at [openrouter.ai/keys](https://openrouter.ai/keys)

3. **Run the dev server:**

   ```bash
   npm run dev
   ```

4. **Open [http://localhost:3000](http://localhost:3000)** and register an account.

## How It Works

1. Register or log in to get a JWT session
2. Create a voice agent (or pick a preset)
3. Click "Start Conversation" on an agent card
4. Tap the microphone to speak — the browser transcribes your voice
5. Your message is sent to OpenRouter's AI with the agent's system prompt
6. The AI's response is displayed and spoken aloud

## Project Structure

```
├── app/
│   ├── (auth)/           # Login & register pages
│   ├── (dashboard)/      # Dashboard & voice chat pages
│   ├── api/              # REST API routes
│   │   ├── auth/         # register, login, me, logout
│   │   ├── agents/       # CRUD for voice agents
│   │   └── chat/         # OpenRouter chat completions
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── auth.ts           # JWT sign/verify utilities
│   ├── db.ts             # File-based JSON storage
│   └── openrouter.ts     # OpenRouter API client
├── types/
│   └── index.ts          # Shared TypeScript types
└── middleware.ts          # Route protection
```

## Notes

- Voice features require a browser that supports the Web Speech API (Chrome, Edge)
- The file-based JSON database is for demo purposes — use a real database in production
- The default AI model (`meta-llama/llama-4-maverick:free`) is free on OpenRouter
