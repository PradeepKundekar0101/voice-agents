import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getAuthUser } from "@/lib/auth";
import { agents } from "@/lib/db";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userAgents = agents.getByUserId(auth.userId);
  return NextResponse.json({ agents: userAgents });
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, description, systemPrompt, voice, model } =
      await request.json();

    if (!name || !systemPrompt) {
      return NextResponse.json(
        { error: "Name and system prompt are required" },
        { status: 400 }
      );
    }

    const agent = agents.create({
      id: uuidv4(),
      userId: auth.userId,
      name,
      description: description || "",
      systemPrompt,
      voice: voice || "default",
      model: model || "openrouter/auto",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ agent }, { status: 201 });
  } catch (err) {
    console.error("Create agent error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
