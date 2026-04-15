import { readFile, writeFile, unlink } from "fs/promises";
import type { Message } from "@/types";
import { config } from "@/utils/config";
import { ensureArcHomeDir, pathExists } from "@/utils/arc-home";

export interface StoredMemory {
  summary: string;
  recentMessages: Message[];
  lastUpdated: string;
}

export async function saveMemory(
  summary: string,
  recentMessages: Message[]
): Promise<void> {
  if (!(await ensureArcHomeDir())) return;

  const data: StoredMemory = {
    summary,
    recentMessages,
    lastUpdated: new Date().toISOString(),
  };

  try {
    await writeFile(config.paths.memoryFile, JSON.stringify(data, null, 2));
  } catch {
    // Memory is best-effort; storage failures should not interrupt a turn.
  }
}

export async function loadMemory(): Promise<StoredMemory | null> {
  try {
    if (!(await ensureArcHomeDir())) return null;

    if (!(await pathExists(config.paths.memoryFile))) {
      return null;
    }

    const content = await readFile(config.paths.memoryFile, "utf-8");
    const data = JSON.parse(content) as StoredMemory;
    return data;
  } catch {
    return null;
  }
}

export async function clearMemory(): Promise<void> {
  try {
    if (!(await ensureArcHomeDir())) return;
    if (await pathExists(config.paths.memoryFile)) {
      await unlink(config.paths.memoryFile);
    }
  } catch {
    // Memory is best-effort; storage may be unavailable.
  }
}

export async function hasStoredMemory(): Promise<boolean> {
  try {
    return pathExists(config.paths.memoryFile);
  } catch {
    return false;
  }
}
