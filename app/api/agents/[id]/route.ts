import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { agents } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const agent = agents.getById(id);
  if (!agent || agent.userId !== auth.userId) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({ agent });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = agents.getById(id);
  if (!existing || existing.userId !== auth.userId) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const updates = await request.json();
  const updated = agents.update(id, updates);
  return NextResponse.json({ agent: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = agents.getById(id);
  if (!existing || existing.userId !== auth.userId) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  agents.delete(id);
  return NextResponse.json({ success: true });
}
