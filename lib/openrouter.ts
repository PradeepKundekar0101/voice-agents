import type { ChatMessage } from "@/types";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

async function attempt(
  messages: ChatMessage[],
  model: string,
  apiKey: string
): Promise<Response> {
  return fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Voice Agent Demo",
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.7,
      max_tokens: 500,
    }),
  });
}

export async function chatCompletion(
  messages: ChatMessage[],
  model: string = "openrouter/auto"
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const modelsToTry = model === "openrouter/auto" ? [model] : [model, "openrouter/auto"];

  for (const m of modelsToTry) {
    for (let i = 0; i < MAX_RETRIES; i++) {
      const response = await attempt(messages, m, apiKey);

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "I couldn't generate a response.";
      }

      if (response.status === 429) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (i + 1)));
        continue;
      }

      const err = await response.text();
      if (response.status === 404 || response.status === 400) break;
      throw new Error(`OpenRouter error: ${response.status} - ${err}`);
    }
  }

  throw new Error("All models are temporarily rate-limited. Please try again in a moment.");
}
