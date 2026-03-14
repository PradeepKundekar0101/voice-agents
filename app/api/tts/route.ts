import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const SAMPLE_RATE = 24000;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

function pcm16ToWav(pcmBase64: string): string {
  const pcmBytes = Buffer.from(pcmBase64, "base64");
  const dataSize = pcmBytes.length;
  const headerSize = 44;
  const wav = Buffer.alloc(headerSize + dataSize);

  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(NUM_CHANNELS, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * (BITS_PER_SAMPLE / 8), 28);
  wav.writeUInt16LE(NUM_CHANNELS * (BITS_PER_SAMPLE / 8), 32);
  wav.writeUInt16LE(BITS_PER_SAMPLE, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  pcmBytes.copy(wav, headerSize);

  return wav.toString("base64");
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const { text, voice } = (await request.json()) as {
      text: string;
      voice?: string;
    };

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Voice Agent Demo",
      },
      body: JSON.stringify({
        model: "openai/gpt-audio-mini",
        messages: [
          {
            role: "system",
            content: "Repeat the user's text exactly as written. Do not add, remove, or change anything.",
          },
          { role: "user", content: text },
        ],
        modalities: ["text", "audio"],
        audio: {
          voice: voice || "nova",
          format: "pcm16",
        },
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("TTS error:", err);
      return NextResponse.json(
        { error: `TTS failed: ${response.status}` },
        { status: response.status }
      );
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const audioChunks: string[] = [];
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") break;

        try {
          const chunk = JSON.parse(data);
          const audio = chunk.choices?.[0]?.delta?.audio;
          if (audio?.data) {
            audioChunks.push(audio.data);
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    if (audioChunks.length === 0) {
      return NextResponse.json({ error: "No audio generated" }, { status: 500 });
    }

    const rawPcm = audioChunks.join("");
    const wavBase64 = pcm16ToWav(rawPcm);

    return NextResponse.json({ audio: wavBase64, format: "wav" });
  } catch (err) {
    console.error("TTS error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS failed" },
      { status: 500 }
    );
  }
}
