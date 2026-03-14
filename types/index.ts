export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  description: string;
  systemPrompt: string;
  voice: string;
  model: string;
  createdAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

export interface AuthPayload {
  userId: string;
  email: string;
}
