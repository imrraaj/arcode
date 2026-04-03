import { readFile, writeFile, mkdir, access } from "fs/promises";
import { join, dirname } from "path";
import { homedir } from "os";
import type { Message, ToolCall } from "../types";

const DATA_DIR = join(homedir(), ".arc");
const MESSAGES_FILE = join(DATA_DIR, "messages.json");
const TOOL_CALLS_FILE = join(DATA_DIR, "toolcalls.json");

export interface PersistedSession {
  messages: Message[];
  toolCalls: ToolCall[];
  timestamp: string;
  model?: string;
}

async function ensureDir() {
  try {
    await access(DATA_DIR);
  } catch {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

export async function saveSession(
  messages: Message[],
  toolCalls: ToolCall[],
  model?: string
): Promise<void> {
  await ensureDir();

  const session: PersistedSession = {
    messages,
    toolCalls,
    timestamp: new Date().toISOString(),
    model,
  };

  await writeFile(MESSAGES_FILE, JSON.stringify(session, null, 2));
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
    await access(MESSAGES_FILE);
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
    // File doesn't exist, nothing to clear
  }
}

export async function exportSession(filepath: string): Promise<void> {
  const session = await loadSession();
  if (session) {
    await writeFile(filepath, JSON.stringify(session, null, 2));
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
