import { readFile, writeFile, mkdir, access, readdir } from "fs/promises";
import { join } from "path";
import type { Message, ToolCall } from "../types";
import { WORKSPACE_ROOT } from "./workspace";

const DATA_DIR = process.env.ARC_DATA_DIR ?? join(WORKSPACE_ROOT, ".arc");
const SESSIONS_DIR = join(DATA_DIR, "sessions");
const CURRENT_SESSION_FILE = join(DATA_DIR, "current-session.json");

type TokenTotals = {
  input: number;
  output: number;
  total: number;
};

const EMPTY_TOKENS: TokenTotals = {
  input: 0,
  output: 0,
  total: 0,
};

export interface PersistedSession {
  id: string;
  title: string;
  messages: Message[];
  toolCalls: ToolCall[];
  timestamp: string;
  model?: string;
  conversationSummary?: string;
  cumulativeTokens?: TokenTotals;
}

export interface SessionMeta {
  id: string;
  title: string;
  timestamp: string;
  model?: string;
  messageCount: number;
}

function sessionFilePath(sessionId: string): string {
  return join(SESSIONS_DIR, `${sessionId}.json`);
}

function generateSessionId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${rand}`;
}

function reviveToolCalls(toolCalls: ToolCall[] | undefined): ToolCall[] {
  if (!toolCalls) return [];
  return toolCalls.map((tc) => ({
    ...tc,
    timestamp: new Date(tc.timestamp),
  }));
}

function normalizeTokens(tokens: TokenTotals | undefined): TokenTotals {
  if (!tokens) return { ...EMPTY_TOKENS };
  return {
    input: tokens.input ?? 0,
    output: tokens.output ?? 0,
    total: tokens.total ?? 0,
  };
}

function deriveTitle(messages: Message[], fallbackId: string): string {
  const firstUser = messages.find((msg) => msg.role === "user")?.content?.trim();
  if (firstUser) {
    const oneLine = firstUser.replace(/\s+/g, " ");
    return oneLine.slice(0, 48);
  }
  return `Session ${fallbackId.slice(0, 8)}`;
}

function normalizeSession(raw: Partial<PersistedSession>, sessionId: string): PersistedSession {
  return {
    id: raw.id ?? sessionId,
    title: raw.title ?? deriveTitle(raw.messages ?? [], sessionId),
    messages: raw.messages ?? [],
    toolCalls: reviveToolCalls(raw.toolCalls),
    timestamp: raw.timestamp ?? new Date().toISOString(),
    model: raw.model,
    conversationSummary: raw.conversationSummary ?? "",
    cumulativeTokens: normalizeTokens(raw.cumulativeTokens),
  };
}

async function ensureDirs(): Promise<boolean> {
  try {
    await access(DATA_DIR);
  } catch {
    try {
      await mkdir(DATA_DIR, { recursive: true });
    } catch {
      return false;
    }
  }

  try {
    await access(SESSIONS_DIR);
    return true;
  } catch {
    try {
      await mkdir(SESSIONS_DIR, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }
}

async function readCurrentSessionId(): Promise<string | null> {
  try {
    const data = await readFile(CURRENT_SESSION_FILE, "utf-8");
    const parsed = JSON.parse(data) as { id?: string };
    return parsed.id ?? null;
  } catch {
    return null;
  }
}

async function writeCurrentSessionId(sessionId: string): Promise<void> {
  try {
    await writeFile(CURRENT_SESSION_FILE, JSON.stringify({ id: sessionId }, null, 2));
  } catch {
    // Best-effort only.
  }
}

async function readSession(sessionId: string): Promise<PersistedSession | null> {
  try {
    const data = await readFile(sessionFilePath(sessionId), "utf-8");
    return normalizeSession(JSON.parse(data) as PersistedSession, sessionId);
  } catch {
    return null;
  }
}

export async function createSession(model?: string): Promise<PersistedSession | null> {
  if (!(await ensureDirs())) return null;

  const id = generateSessionId();
  const session: PersistedSession = {
    id,
    title: `Session ${new Date().toLocaleString()}`,
    messages: [],
    toolCalls: [],
    timestamp: new Date().toISOString(),
    model,
    conversationSummary: "",
    cumulativeTokens: { ...EMPTY_TOKENS },
  };

  try {
    await writeFile(sessionFilePath(id), JSON.stringify(session, null, 2));
    await writeCurrentSessionId(id);
    return session;
  } catch {
    return null;
  }
}

export async function listSessions(): Promise<SessionMeta[]> {
  if (!(await ensureDirs())) return [];

  let files: string[] = [];
  try {
    files = await readdir(SESSIONS_DIR);
  } catch {
    return [];
  }

  const sessions = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file): Promise<SessionMeta | null> => {
        const id = file.slice(0, -5);
        const session = await readSession(id);
        if (!session) return null;

        const meta: SessionMeta = {
          id: session.id,
          title: session.title,
          timestamp: session.timestamp,
          messageCount: session.messages.length,
          ...(session.model ? { model: session.model } : {}),
        };
        return meta;
      })
  );

  return sessions
    .filter((session): session is SessionMeta => session !== null)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function saveSession(
  sessionId: string,
  messages: Message[],
  toolCalls: ToolCall[],
  model?: string,
  conversationSummary?: string,
  cumulativeTokens?: TokenTotals,
  title?: string
): Promise<void> {
  if (!(await ensureDirs())) return;
  const existing = await readSession(sessionId);
  const resolvedTitle =
    title ??
    existing?.title ??
    deriveTitle(messages, sessionId);

  try {
    await writeFile(
      sessionFilePath(sessionId),
      JSON.stringify(
        {
          id: sessionId,
          title: resolvedTitle,
          messages,
          toolCalls,
          timestamp: new Date().toISOString(),
          model,
          conversationSummary: conversationSummary ?? existing?.conversationSummary ?? "",
          cumulativeTokens: normalizeTokens(cumulativeTokens ?? existing?.cumulativeTokens),
        } satisfies PersistedSession,
        null,
        2
      )
    );
    await writeCurrentSessionId(sessionId);
  } catch {
    // Persistence is best-effort.
  }
}

export async function loadSession(sessionId?: string): Promise<PersistedSession | null> {
  if (!(await ensureDirs())) return null;

  if (sessionId) {
    const session = await readSession(sessionId);
    if (session) await writeCurrentSessionId(session.id);
    return session;
  }

  const current = await readCurrentSessionId();
  if (current) {
    const session = await readSession(current);
    if (session) return session;
  }

  const sessions = await listSessions();
  if (sessions.length > 0) {
    const latest = await readSession(sessions[0].id);
    if (latest) {
      await writeCurrentSessionId(latest.id);
      return latest;
    }
  }

  return null;
}

export async function clearSession(sessionId: string): Promise<void> {
  const existing = await readSession(sessionId);
  await saveSession(
    sessionId,
    [],
    [],
    existing?.model,
    "",
    { ...EMPTY_TOKENS },
    existing?.title
  );
}

export async function getCurrentSessionId(): Promise<string | null> {
  const loaded = await loadSession();
  if (!loaded) return null;
  return loaded.id;
}

export async function exportSession(sessionId: string, filepath: string): Promise<void> {
  const session = await loadSession(sessionId);
  if (!session) return;

  try {
    await writeFile(filepath, JSON.stringify(session, null, 2));
  } catch {
    // Best-effort only.
  }
}

export async function importSession(filepath: string): Promise<PersistedSession | null> {
  if (!(await ensureDirs())) return null;

  try {
    const data = await readFile(filepath, "utf-8");
    const parsed = JSON.parse(data) as Partial<PersistedSession>;
    const id = parsed.id ?? generateSessionId();
    const session = normalizeSession(parsed, id);
    await writeFile(sessionFilePath(id), JSON.stringify(session, null, 2));
    await writeCurrentSessionId(id);
    return session;
  } catch {
    return null;
  }
}
