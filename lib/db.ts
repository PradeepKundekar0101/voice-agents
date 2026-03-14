import fs from "fs";
import path from "path";
import type { User, Agent } from "@/types";

const DB_PATH = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DB_PATH, "users.json");
const AGENTS_FILE = path.join(DB_PATH, "agents.json");

function ensureDir() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH, { recursive: true });
  }
}

function readJSON<T>(filePath: string): T[] {
  ensureDir();
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T[];
}

function writeJSON<T>(filePath: string, data: T[]) {
  ensureDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export const users = {
  getAll: (): User[] => readJSON<User>(USERS_FILE),
  getById: (id: string): User | undefined =>
    readJSON<User>(USERS_FILE).find((u) => u.id === id),
  getByEmail: (email: string): User | undefined =>
    readJSON<User>(USERS_FILE).find((u) => u.email === email),
  create: (user: User): User => {
    const all = readJSON<User>(USERS_FILE);
    all.push(user);
    writeJSON(USERS_FILE, all);
    return user;
  },
};

export const agents = {
  getAll: (): Agent[] => readJSON<Agent>(AGENTS_FILE),
  getByUserId: (userId: string): Agent[] =>
    readJSON<Agent>(AGENTS_FILE).filter((a) => a.userId === userId),
  getById: (id: string): Agent | undefined =>
    readJSON<Agent>(AGENTS_FILE).find((a) => a.id === id),
  create: (agent: Agent): Agent => {
    const all = readJSON<Agent>(AGENTS_FILE);
    all.push(agent);
    writeJSON(AGENTS_FILE, all);
    return agent;
  },
  update: (id: string, updates: Partial<Agent>): Agent | null => {
    const all = readJSON<Agent>(AGENTS_FILE);
    const idx = all.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...updates };
    writeJSON(AGENTS_FILE, all);
    return all[idx];
  },
  delete: (id: string): boolean => {
    const all = readJSON<Agent>(AGENTS_FILE);
    const filtered = all.filter((a) => a.id !== id);
    if (filtered.length === all.length) return false;
    writeJSON(AGENTS_FILE, filtered);
    return true;
  },
};
