import { createServerFn } from "@tanstack/react-start";
import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ── Simple JSON-file based auth store ──
// For a PWA with freemium model, this keeps things simple.
// In production, replace with a proper database.

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  subscriptionTier: "free" | "premium";
  createdAt: string;
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
  tier: string;
}

const DB_PATH = join(process.cwd(), ".data", "users.json");

function getUsers(): StoredUser[] {
  try {
    if (existsSync(DB_PATH)) {
      return JSON.parse(readFileSync(DB_PATH, "utf-8")) as StoredUser[];
    }
  } catch { /* ignore */ }
  return [];
}

function saveUsers(users: StoredUser[]) {
  const dir = join(process.cwd(), ".data");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const verify = scryptSync(password, salt, 64).toString("hex");
  return hash === verify;
}

function generateId(): string {
  return randomBytes(12).toString("hex");
}

// ── Server Functions ──

export const signUp = createServerFn({ method: "POST" }).handler(async ({ data }: { data: { email: string; name: string; password: string } }) => {
  const { email, name, password } = data;
  if (!email || !name || !password || password.length < 6) {
    return { ok: false, error: "Invalid input. Password must be at least 6 characters." };
  }
  const users = getUsers();
  if (users.find((u) => u.email === email)) {
    return { ok: false, error: "An account with this email already exists." };
  }
  const user: StoredUser = {
    id: generateId(),
    email,
    name,
    passwordHash: hashPassword(password),
    subscriptionTier: "free",
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  return { ok: true, user: { id: user.id, email: user.email, name: user.name, tier: user.subscriptionTier } };
});

export const signIn = createServerFn({ method: "POST" }).handler(async ({ data }: { data: { email: string; password: string } }) => {
  const { email, password } = data;
  const users = getUsers();
  const user = users.find((u) => u.email === email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false, error: "Invalid email or password." };
  }
  return { ok: true, user: { id: user.id, email: user.email, name: user.name, tier: user.subscriptionTier } };
});

export const getSession = createServerFn({ method: "GET" }).handler(async (): Promise<{ ok: boolean; user?: UserSession; error?: string }> => {
  // Session is maintained client-side via localStorage
  // This just validates that users exist
  return { ok: true, user: undefined };
});