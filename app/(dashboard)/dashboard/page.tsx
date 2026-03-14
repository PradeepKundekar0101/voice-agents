"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Agent } from "@/types";

const PRESET_AGENTS = [
  {
    name: "Friendly Assistant",
    description: "A warm, helpful general-purpose voice assistant",
    systemPrompt:
      "You are a friendly, warm voice assistant. Keep your responses concise (2-3 sentences max) since they will be spoken aloud. Be helpful, personable, and conversational. Avoid using markdown, bullet points, or special formatting.",
    voice: "default",
  },
  {
    name: "Tech Support",
    description: "Patient technical support specialist",
    systemPrompt:
      "You are a patient, knowledgeable tech support specialist. Speak clearly and guide users step by step. Keep responses short (2-3 sentences) since they'll be spoken aloud. Avoid jargon. Never use markdown or special formatting.",
    voice: "default",
  },
  {
    name: "Language Tutor",
    description: "Conversational language learning partner",
    systemPrompt:
      "You are a fun, encouraging language tutor. Help users practice conversation. Gently correct mistakes. Keep responses short (2-3 sentences) since they will be spoken aloud. Be enthusiastic and patient. Never use markdown or special formatting.",
    voice: "default",
  },
  {
    name: "Interview Coach",
    description: "Practice job interviews with AI feedback",
    systemPrompt:
      "You are a professional interview coach. Ask interview questions, listen to answers, and give brief constructive feedback. Keep responses to 2-3 sentences since they will be spoken aloud. Be encouraging but honest. Never use markdown or special formatting.",
    voice: "default",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [userName, setUserName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: "",
    description: "",
    systemPrompt: "",
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUserName(d.user?.name || ""))
      .catch(() => {});
    fetchAgents();
  }, [fetchAgents]);

  async function createAgent(overrides?: Partial<typeof newAgent>) {
    setCreating(true);
    const payload = overrides || newAgent;
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setNewAgent({ name: "", description: "", systemPrompt: "" });
        setShowCreate(false);
        fetchAgents();
      }
    } finally {
      setCreating(false);
    }
  }

  async function deleteAgent(id: string) {
    await fetch(`/api/agents/${id}`, { method: "DELETE" });
    fetchAgents();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 border border-accent/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight">VoxAI</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted hidden sm:block">
              {userName}
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-border px-3.5 py-1.5 text-sm text-muted transition-colors hover:text-foreground hover:border-foreground/20"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Voice Agents</h1>
            <p className="mt-1 text-muted text-sm">
              Create AI agents and have voice conversations
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110"
          >
            + New Agent
          </button>
        </div>

        {showCreate && (
          <div className="mb-10 rounded-2xl border border-border bg-surface p-6 animate-fade-in">
            <h2 className="text-lg font-semibold mb-5">Create Custom Agent</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm text-muted">Name</label>
                <input
                  value={newAgent.name}
                  onChange={(e) =>
                    setNewAgent({ ...newAgent, name: e.target.value })
                  }
                  placeholder="My Agent"
                  className="w-full rounded-xl bg-background border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 outline-none focus:border-accent/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted">Description</label>
                <input
                  value={newAgent.description}
                  onChange={(e) =>
                    setNewAgent({ ...newAgent, description: e.target.value })
                  }
                  placeholder="What does this agent do?"
                  className="w-full rounded-xl bg-background border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 outline-none focus:border-accent/50"
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <label className="text-sm text-muted">System Prompt</label>
              <textarea
                value={newAgent.systemPrompt}
                onChange={(e) =>
                  setNewAgent({ ...newAgent, systemPrompt: e.target.value })
                }
                placeholder="You are a helpful assistant. Keep responses concise since they will be spoken aloud..."
                rows={3}
                className="w-full rounded-xl bg-background border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 outline-none focus:border-accent/50 resize-none"
              />
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => createAgent()}
                disabled={creating || !newAgent.name || !newAgent.systemPrompt}
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? "Creating..." : "Create Agent"}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-border px-5 py-2.5 text-sm text-muted transition-colors hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {agents.length === 0 && !loading && (
          <div className="mb-10">
            <h2 className="text-lg font-semibold mb-4 text-muted">
              Quick Start &mdash; Choose a preset
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {PRESET_AGENTS.map((preset, i) => (
                <button
                  key={i}
                  onClick={() => createAgent(preset)}
                  disabled={creating}
                  className="group rounded-2xl border border-border bg-surface p-5 text-left transition-all hover:border-accent/30 hover:bg-surface-hover disabled:opacity-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent text-lg">
                      {["🤖", "🔧", "🌐", "💼"][i]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">
                        {preset.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted leading-relaxed">
                        {preset.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        ) : (
          agents.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="group relative rounded-2xl border border-border bg-surface p-5 transition-all hover:border-accent/30 hover:bg-surface-hover"
                >
                  <button
                    onClick={() => deleteAgent(agent.id)}
                    className="absolute top-3 right-3 rounded-lg p-1.5 text-muted opacity-0 transition-all hover:text-danger hover:bg-danger/10 group-hover:opacity-100"
                    title="Delete agent"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 text-accent">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-foreground">{agent.name}</h3>
                  <p className="mt-1 text-sm text-muted line-clamp-2 leading-relaxed">
                    {agent.description || agent.systemPrompt.slice(0, 80) + "..."}
                  </p>
                  <button
                    onClick={() => router.push(`/agents/${agent.id}`)}
                    className="mt-4 w-full rounded-xl bg-accent/10 border border-accent/20 px-4 py-2.5 text-sm font-medium text-accent transition-all hover:bg-accent/20"
                  >
                    Start Conversation
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}
