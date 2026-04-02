import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import type { Message } from "../ui/MessageView.js";

export interface StoredMemory {
  summary: string;
  recentMessages: Message[];
  lastUpdated: string;
}

const ARC_DIR = join(process.env.HOME || "~", ".arc");
const MEMORY_FILE = join(ARC_DIR, "memory.json");

export async function ensureArcDir(): Promise<void> {
  if (!existsSync(ARC_DIR)) {
    mkdirSync(ARC_DIR, { recursive: true });
  }
}

export async function saveMemory(
  summary: string,
  recentMessages: Message[]
): Promise<void> {
  await ensureArcDir();

  const data: StoredMemory = {
    summary,
    recentMessages,
    lastUpdated: new Date().toISOString(),
  };

  writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
}

export async function loadMemory(): Promise<StoredMemory | null> {
  try {
    await ensureArcDir();

    if (!existsSync(MEMORY_FILE)) {
      return null;
    }

    const content = readFileSync(MEMORY_FILE, "utf-8");
    const data = JSON.parse(content) as StoredMemory;
    return data;
  } catch (error) {
    console.error("Failed to load memory:", error);
    return null;
  }
}

export async function clearMemory(): Promise<void> {
  try {
    await ensureArcDir();
    if (existsSync(MEMORY_FILE)) {
      unlinkSync(MEMORY_FILE);
    }
  } catch (error) {
    console.error("Failed to clear memory:", error);
  }
}

export async function hasStoredMemory(): Promise<boolean> {
  try {
    return existsSync(MEMORY_FILE);
  } catch {
    return false;
  }
}
