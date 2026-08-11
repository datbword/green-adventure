import { createServerFn } from "@tanstack/react-start";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

// ── Data Types ──

export interface SavedPart {
  partNumber: string;
  manufacturer: string;
  series: string;
  function: string;
  finish: string;
  keyway: string;
  pins?: string;
  handing: string;
  backset: string;
  notes: string;
}

export interface Job {
  id: string;
  userId: string;
  name: string;
  notes: string;
  parts: SavedPart[];
  createdAt: string;
  updatedAt: string;
}

const DB_PATH = join(process.cwd(), ".data", "jobs.json");

function getJobs(): Job[] {
  try {
    if (existsSync(DB_PATH)) {
      return JSON.parse(readFileSync(DB_PATH, "utf-8")) as Job[];
    }
  } catch { /* ignore */ }
  return [];
}

function saveJobs(jobs: Job[]) {
  const dir = join(process.cwd(), ".data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(jobs, null, 2));
}

function genId(): string {
  return randomBytes(8).toString("hex");
}

// ── Server Functions ──

export const listJobs = createServerFn({ method: "GET" }).handler(
  async ({ data }: { data: { userId: string } }) => {
    const jobs = getJobs().filter((j) => j.userId === data.userId);
    return { ok: true, jobs };
  },
);

export const createJob = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: { userId: string; name: string; notes: string } }) => {
    const now = new Date().toISOString();
    const job: Job = {
      id: genId(),
      userId: data.userId,
      name: data.name,
      notes: data.notes || "",
      parts: [],
      createdAt: now,
      updatedAt: now,
    };
    const jobs = getJobs();
    jobs.push(job);
    saveJobs(jobs);
    return { ok: true, job };
  },
);

export const addPartToJob = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: { userId: string; jobId: string; part: SavedPart } }) => {
    const jobs = getJobs();
    const idx = jobs.findIndex((j) => j.id === data.jobId && j.userId === data.userId);
    if (idx === -1) return { ok: false, error: "Job not found" };
    jobs[idx].parts.push(data.part);
    jobs[idx].updatedAt = new Date().toISOString();
    saveJobs(jobs);
    return { ok: true, job: jobs[idx] };
  },
);

export const removePartFromJob = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: { userId: string; jobId: string; partIndex: number } }) => {
    const jobs = getJobs();
    const idx = jobs.findIndex((j) => j.id === data.jobId && j.userId === data.userId);
    if (idx === -1) return { ok: false, error: "Job not found" };
    if (data.partIndex < 0 || data.partIndex >= jobs[idx].parts.length) {
      return { ok: false, error: "Invalid part index" };
    }
    jobs[idx].parts.splice(data.partIndex, 1);
    jobs[idx].updatedAt = new Date().toISOString();
    saveJobs(jobs);
    return { ok: true, job: jobs[idx] };
  },
);

export const deleteJob = createServerFn({ method: "POST" }).handler(
  async ({ data }: { data: { userId: string; jobId: string } }) => {
    let jobs = getJobs();
    const before = jobs.length;
    jobs = jobs.filter((j) => !(j.id === data.jobId && j.userId === data.userId));
    if (jobs.length === before) return { ok: false, error: "Job not found" };
    saveJobs(jobs);
    return { ok: true };
  },
);

export const getJob = createServerFn({ method: "GET" }).handler(
  async ({ data }: { data: { userId: string; jobId: string } }) => {
    const jobs = getJobs();
    const job = jobs.find((j) => j.id === data.jobId && j.userId === data.userId);
    if (!job) return { ok: false, error: "Job not found" };
    return { ok: true, job };
  },
);