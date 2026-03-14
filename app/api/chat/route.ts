import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { agents, users } from "@/lib/db";
import { chatCompletion } from "@/lib/openrouter";
import type { ChatMessage } from "@/types";

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { agentId, messages, greet } = (await request.json()) as {
      agentId: string;
      messages: ChatMessage[];
      greet?: boolean;
    };

    const agent = agents.getById(agentId);
    if (!agent || agent.userId !== auth.userId) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const user = users.getById(auth.userId);
    const userName = user?.name || "there";

    const systemContent = greet
      ? `${agent.systemPrompt}\n\nThe user's name is ${userName}. Start the conversation with a warm, natural greeting using their name. Be casual and engaging — like you're happy to talk to them. Keep it to 1-2 short sentences.`
      : `${agent.systemPrompt}\n\nThe user's name is ${userName}.`;

    const fullMessages: ChatMessage[] = [
      { role: "system", content: systemContent },
      ...messages,
    ];

    const reply = await chatCompletion(fullMessages, agent.model);

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to get AI response",
      },
      { status: 500 }
    );
  }
}
