"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import type { Agent, ChatMessage } from "@/types";

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

type CallState = "connecting" | "greeting" | "listening" | "thinking" | "speaking" | "idle";

function base64ToBlob(base64: string, mime: string): Blob {
  const bytes = atob(base64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

export default function AgentChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [callState, setCallState] = useState<CallState>("connecting");
  const [transcript, setTranscript] = useState("");
  const [lastSpoken, setLastSpoken] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const callStartRef = useRef<number>(Date.now());
  const autoListenRef = useRef(true);
  const hasGreetedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  messagesRef.current = messages;

  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const speakWithAI = useCallback(async (text: string, onDone?: () => void) => {
    setCallState("speaking");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "nova" }),
      });

      if (!res.ok) throw new Error("TTS failed");

      const data = await res.json();
      const blob = base64ToBlob(data.audio, "audio/wav");
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        onDone?.();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        onDone?.();
      };

      await audio.play();
    } catch {
      onDone?.();
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setCallState("idle");
  }, []);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    stopSpeaking();
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) {
        setTranscript(final);
        sendMessageFromVoice(final);
      } else {
        setTranscript(interim);
      }
    };

    recognition.onerror = () => setCallState("idle");
    recognition.onend = () => {};

    recognitionRef.current = recognition;
    recognition.start();
    setCallState("listening");
    setTranscript("");
  }, [stopSpeaking]);

  const sendMessageFromVoice = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const userMsg: ChatMessage = {
        role: "user",
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };
      const updated = [...messagesRef.current, userMsg];
      setMessages(updated);
      messagesRef.current = updated;
      setTranscript("");
      setCallState("thinking");

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: id,
            messages: updated.map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: data.reply,
          timestamp: new Date().toISOString(),
        };
        const withReply = [...updated, assistantMsg];
        setMessages(withReply);
        messagesRef.current = withReply;
        setLastSpoken(data.reply);

        speakWithAI(data.reply, () => {
          setCallState("idle");
          if (autoListenRef.current) {
            setTimeout(() => startListening(), 400);
          }
        });
      } catch {
        setCallState("idle");
        setLastSpoken("Sorry, I had trouble responding. Try again.");
      }
    },
    [id, speakWithAI, startListening]
  );

  useEffect(() => {
    fetch(`/api/agents/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        setAgent(d.agent);
        if (!hasGreetedRef.current) {
          hasGreetedRef.current = true;
          triggerGreeting();
        }
      })
      .catch(() => router.push("/dashboard"));

    async function triggerGreeting() {
      setCallState("greeting");
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: id, messages: [], greet: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const greetMsg: ChatMessage = {
          role: "assistant",
          content: data.reply,
          timestamp: new Date().toISOString(),
        };
        setMessages([greetMsg]);
        messagesRef.current = [greetMsg];
        setLastSpoken(data.reply);

        speakWithAI(data.reply, () => {
          setCallState("idle");
          setTimeout(() => startListening(), 400);
        });
      } catch {
        setCallState("idle");
        setLastSpoken("Hey! I'm ready to chat.");
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      recognitionRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function endCall() {
    autoListenRef.current = false;
    stopSpeaking();
    recognitionRef.current?.abort();
    router.push("/dashboard");
  }

  function toggleMute() {
    if (callState === "listening") {
      recognitionRef.current?.stop();
      autoListenRef.current = false;
      setCallState("idle");
    } else if (callState === "idle") {
      autoListenRef.current = true;
      startListening();
    } else if (callState === "speaking") {
      stopSpeaking();
      autoListenRef.current = true;
      setTimeout(() => startListening(), 200);
    }
  }

  const orbPulse = callState === "listening" || callState === "speaking";
  const statusText = {
    connecting: "Connecting...",
    greeting: "Agent is joining...",
    listening: "Listening to you...",
    thinking: "Thinking...",
    speaking: "Speaking...",
    idle: "Tap mic to speak",
  }[callState];

  if (!agent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="text-sm text-muted">Connecting to agent...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background overflow-hidden relative">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl transition-all duration-1000 ${
            callState === "speaking"
              ? "bg-accent/15"
              : callState === "listening"
              ? "bg-blue-500/15"
              : callState === "thinking"
              ? "bg-amber-400/10"
              : "bg-muted/5"
          } ${orbPulse ? "animate-pulse-ring" : ""}`}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-6">
        <button
          onClick={endCall}
          className="rounded-xl bg-surface/60 border border-border backdrop-blur-md px-4 py-2 text-sm text-muted transition-all hover:text-foreground hover:border-foreground/20"
        >
          &larr; Back
        </button>
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          <span className="text-sm font-mono text-muted">{formatDuration(callDuration)}</span>
        </div>
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className={`rounded-xl px-4 py-2 text-sm backdrop-blur-md border transition-all ${
            showTranscript
              ? "bg-accent/10 border-accent/30 text-accent"
              : "bg-surface/60 border-border text-muted hover:text-foreground"
          }`}
        >
          Transcript
        </button>
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
        {/* Orb */}
        <div className="relative mb-8">
          {orbPulse && (
            <>
              <div className="absolute inset-0 -m-6 rounded-full border border-accent/10 animate-pulse-ring" />
              <div
                className="absolute inset-0 -m-12 rounded-full border border-accent/5 animate-pulse-ring"
                style={{ animationDelay: "0.5s" }}
              />
            </>
          )}

          <div
            className={`relative flex h-32 w-32 items-center justify-center rounded-full transition-all duration-500 ${
              callState === "speaking"
                ? "bg-gradient-to-br from-accent/30 to-accent/10 shadow-[0_0_60px_rgba(0,212,170,0.3)]"
                : callState === "listening"
                ? "bg-gradient-to-br from-blue-500/30 to-blue-500/10 shadow-[0_0_60px_rgba(59,130,246,0.3)]"
                : callState === "thinking"
                ? "bg-gradient-to-br from-amber-400/30 to-amber-400/10 shadow-[0_0_60px_rgba(251,191,36,0.2)]"
                : "bg-gradient-to-br from-surface to-surface-hover"
            }`}
          >
            {(callState === "listening" || callState === "speaking") && (
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 rounded-full ${
                      callState === "speaking" ? "bg-accent" : "bg-blue-400"
                    } waveform-bar`}
                    style={{
                      animationDelay: `${i * 0.12}s`,
                      animationDuration: `${0.4 + Math.random() * 0.4}s`,
                    }}
                  />
                ))}
              </div>
            )}

            {callState === "thinking" && (
              <div className="flex gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}

            {(callState === "idle" || callState === "connecting" || callState === "greeting") && (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent/80">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            )}
          </div>
        </div>

        {/* Agent name & status */}
        <h1 className="text-2xl font-bold tracking-tight mb-1">{agent.name}</h1>
        <p className={`text-sm transition-colors duration-300 ${
          callState === "listening" ? "text-blue-400" :
          callState === "speaking" ? "text-accent" :
          callState === "thinking" ? "text-amber-400" :
          "text-muted"
        }`}>
          {statusText}
        </p>

        {/* Live transcript / last spoken */}
        <div className="mt-8 w-full max-w-md text-center min-h-[60px]">
          {callState === "listening" && transcript && (
            <p className="text-foreground/80 text-lg animate-fade-in">
              &ldquo;{transcript}&rdquo;
              <span className="ml-0.5 inline-block h-5 w-0.5 bg-blue-400 animate-pulse" />
            </p>
          )}
          {(callState === "speaking" || callState === "idle") && lastSpoken && (
            <p className="text-muted text-sm leading-relaxed animate-fade-in line-clamp-3">
              {lastSpoken}
            </p>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 flex items-center justify-center gap-6 pb-12 pt-4">
        <button
          onClick={toggleMute}
          disabled={callState === "thinking" || callState === "connecting" || callState === "greeting"}
          className={`relative rounded-full p-5 transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
            callState === "listening"
              ? "bg-blue-500 text-white shadow-[0_0_30px_rgba(59,130,246,0.4)]"
              : "bg-surface border border-border text-muted hover:text-foreground hover:border-foreground/20"
          }`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {callState === "listening" ? (
              <>
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </>
            ) : (
              <>
                <line x1="2" x2="22" y1="2" y2="22" />
                <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                <path d="M5 10v2a7 7 0 0 0 12 5" />
                <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </>
            )}
          </svg>
        </button>

        <button
          onClick={endCall}
          className="rounded-full bg-danger p-5 text-white transition-all hover:brightness-110 shadow-[0_0_30px_rgba(244,63,94,0.3)]"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 2.59 3.4Z" />
          </svg>
        </button>
      </div>

      {/* Transcript drawer */}
      {showTranscript && (
        <div className="absolute inset-0 z-20 bg-background/95 backdrop-blur-xl animate-fade-in overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Conversation</h2>
              <button
                onClick={() => setShowTranscript(false)}
                className="rounded-lg p-2 text-muted hover:text-foreground transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            {messages.length === 0 ? (
              <p className="text-muted text-sm">No messages yet.</p>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-500/20 border border-blue-500/30 text-foreground rounded-br-md"
                        : "bg-surface border border-border text-foreground rounded-bl-md"
                    }`}>
                      <span className="text-[10px] uppercase tracking-widest text-muted block mb-1">
                        {msg.role === "user" ? "You" : agent?.name}
                      </span>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
