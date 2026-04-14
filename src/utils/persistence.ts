import { readFile, writeFile, mkdir, access } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import type { Message, ToolCall } from "../types";

const DATA_DIR = join(homedir(), ".arc");
const MESSAGES_FILE = join(DATA_DIR, "messages.json");

export interface PersistedSession {
  messages: Message[];
  toolCalls: ToolCall[];
  timestamp: string;
  model?: string;
}

async function ensureDir(): Promise<boolean> {
  try {
    await access(DATA_DIR);
    return true;
  } catch {
    try {
      await mkdir(DATA_DIR, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }
}

export async function saveSession(
  messages: Message[],
  toolCalls: ToolCall[],
  model?: string
): Promise<void> {
  if (!(await ensureDir())) return;

  const session: PersistedSession = {
    messages,
    toolCalls,
    timestamp: new Date().toISOString(),
    model,
  };

  try {
    await writeFile(MESSAGES_FILE, JSON.stringify(session, null, 2));
  } catch {
    // Persistence is best-effort; the TUI should keep working on read-only homes.
  }
}

export async function loadSession(): Promise<PersistedSession | null> {
  try {
    await access(MESSAGES_FILE);
    const data = await readFile(MESSAGES_FILE, "utf-8");
    const session = JSON.parse(data) as PersistedSession;

    // Revive dates for tool calls
    if (session.toolCalls) {
      session.toolCalls = session.toolCalls.map((tc) => ({
        ...tc,
        timestamp: new Date(tc.timestamp),
      }));
    }

    return session;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    if (!(await ensureDir())) return;
    await writeFile(
      MESSAGES_FILE,
      JSON.stringify(
        {
          messages: [],
          toolCalls: [],
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch {
    // Persistence is best-effort; nothing to clear or storage is unavailable.
  }
}

export async function exportSession(filepath: string): Promise<void> {
  const session = await loadSession();
  if (session) {
    try {
      await writeFile(filepath, JSON.stringify(session, null, 2));
    } catch {
      // Export is best-effort for now; callers can verify the file exists.
    }
  }
}

export async function importSession(filepath: string): Promise<PersistedSession | null> {
  try {
    const data = await readFile(filepath, "utf-8");
    const session = JSON.parse(data) as PersistedSession;

    // Revive dates
    if (session.toolCalls) {
      session.toolCalls = session.toolCalls.map((tc) => ({
        ...tc,
        timestamp: new Date(tc.timestamp),
      }));
    }

    await saveSession(session.messages, session.toolCalls, session.model);
    return session;
  } catch {
    return null;
  }
}
