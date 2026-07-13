import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const PENDING_PATH = join(process.cwd(), ".data", "pending-emails.json");

interface PendingEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: "pending" | "sent" | "failed";
  error?: string;
  createdAt: string;
}

export function getPendingEmails(): PendingEmail[] {
  try {
    if (existsSync(PENDING_PATH)) {
      return JSON.parse(readFileSync(PENDING_PATH, "utf-8")) as PendingEmail[];
    }
  } catch { /* ignore */ }
  return [];
}

export function addPendingEmail(data: { to: string; subject: string; body: string }): PendingEmail {
  const pending: PendingEmail = {
    id: Math.random().toString(36).slice(2, 10),
    ...data,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  const all = getPendingEmails();
  all.push(pending);
  const dir = join(process.cwd(), ".data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(PENDING_PATH, JSON.stringify(all, null, 2));
  return pending;
}

export function markEmailSent(id: string) {
  const all = getPendingEmails();
  const idx = all.findIndex((e) => e.id === id);
  if (idx !== -1) {
    all[idx].status = "sent";
    writeFileSync(PENDING_PATH, JSON.stringify(all, null, 2));
  }
}

export function markEmailFailed(id: string, error: string) {
  const all = getPendingEmails();
  const idx = all.findIndex((e) => e.id === id);
  if (idx !== -1) {
    all[idx].status = "failed";
    all[idx].error = error;
    writeFileSync(PENDING_PATH, JSON.stringify(all, null, 2));
  }
}