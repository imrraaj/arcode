import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import type { Message } from "../types";
import { WORKSPACE_ROOT } from "../utils/workspace";

export interface StoredMemory {
  summary: string;
  recentMessages: Message[];
  lastUpdated: string;
}

const ARC_DIR = process.env.ARC_DATA_DIR ?? join(WORKSPACE_ROOT, ".arc");
const MEMORY_FILE = join(ARC_DIR, "memory.json");

export async function ensureArcDir(): Promise<boolean> {
  try {
    if (!existsSync(ARC_DIR)) {
      mkdirSync(ARC_DIR, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

export async function saveMemory(
  summary: string,
  recentMessages: Message[]
): Promise<void> {
  if (!(await ensureArcDir())) return;

  const data: StoredMemory = {
    summary,
    recentMessages,
    lastUpdated: new Date().toISOString(),
  };

  try {
    writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
  } catch {
    // Memory is best-effort; storage failures should not interrupt a turn.
  }
}

export async function loadMemory(): Promise<StoredMemory | null> {
  try {
    if (!(await ensureArcDir())) return null;

    if (!existsSync(MEMORY_FILE)) {
      return null;
    }

    const content = readFileSync(MEMORY_FILE, "utf-8");
    const data = JSON.parse(content) as StoredMemory;
    return data;
  } catch {
    return null;
  }
}

export async function clearMemory(): Promise<void> {
  try {
    if (!(await ensureArcDir())) return;
    if (existsSync(MEMORY_FILE)) {
      unlinkSync(MEMORY_FILE);
    }
  } catch {
    // Memory is best-effort; storage may be unavailable.
  }
}

export async function hasStoredMemory(): Promise<boolean> {
  try {
    return existsSync(MEMORY_FILE);
  } catch {
    return false;
  }
}
