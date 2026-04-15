import { Database } from "bun:sqlite";
import { mkdir, readFile, readdir } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import type { Message, ToolCall } from "@/types";
import { config } from "@/utils/config";

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

type SessionRow = {
  id: string;
  title: string;
  model: string | null;
  conversation_summary: string | null;
  updated_at: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
};

type SessionMetaRow = {
  id: string;
  title: string;
  timestamp: string;
  model: string | null;
  message_count: number;
};

type MessageRow = {
  role: Message["role"];
  content: string;
};

type ToolCallRow = {
  id: string;
  assistant_message_index: number;
  name: string;
  args_json: string;
  result_json: string | null;
  status: ToolCall["status"];
  timestamp: string;
};

const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations", import.meta.url));

let db: Database | null = null;

function generateSessionId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${rand}`;
}

function normalizeTokens(tokens: TokenTotals | undefined | null): TokenTotals {
  return {
    input: tokens?.input ?? 0,
    output: tokens?.output ?? 0,
    total: tokens?.total ?? 0,
  };
}

function deriveTitle(messages: Message[], fallbackId: string): string {
  const firstUser = messages.find((msg) => msg.role === "user")?.content?.trim();
  if (firstUser) return firstUser.replace(/\s+/g, " ").slice(0, 48);
  return `Session ${fallbackId.slice(0, 8)}`;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function reviveToolCall(row: ToolCallRow): ToolCall {
  const result = row.result_json === null
    ? {}
    : { result: parseJson(row.result_json, undefined) };

  return {
    id: row.id,
    assistantMessageIndex: row.assistant_message_index,
    name: row.name,
    args: parseJson(row.args_json, {}),
    status: row.status,
    timestamp: new Date(row.timestamp),
    ...result,
  };
}

function toPersistedSession(
  row: SessionRow,
  messages: Message[],
  toolCalls: ToolCall[],
): PersistedSession {
  return {
    id: row.id,
    title: row.title,
    messages,
    toolCalls,
    timestamp: row.updated_at,
    ...(row.model ? { model: row.model } : {}),
    conversationSummary: row.conversation_summary ?? "",
    cumulativeTokens: {
      input: row.input_tokens ?? 0,
      output: row.output_tokens ?? 0,
      total: row.total_tokens ?? 0,
    },
  };
}

type Migration = {
  filename: string;
  version: number;
};

async function listMigrations(): Promise<Migration[]> {
  const files = await readdir(MIGRATIONS_DIR);
  return files
    .map((filename): Migration | null => {
      const match = filename.match(/^(\d+)_.*\.sql$/);
      if (!match?.[1]) return null;
      return {
        filename,
        version: Number(match[1]),
      };
    })
    .filter((migration): migration is Migration => migration !== null)
    .sort((a, b) => a.version - b.version);
}

function getSchemaVersion(database: Database): number {
  const row = database.query("PRAGMA user_version").get() as {
    user_version?: number;
  } | null;
  return row?.user_version ?? 0;
}

async function applyMigrations(database: Database): Promise<void> {
  const currentVersion = getSchemaVersion(database);
  const migrations = await listMigrations();
  const runMigration = database.transaction((sql: string, version: number) => {
    database.run(sql);
    database.run(`PRAGMA user_version = ${version}`);
  });

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;

    const sql = await readFile(join(MIGRATIONS_DIR, migration.filename), "utf-8");
    runMigration(sql, migration.version);
  }
}

async function getDb(): Promise<Database | null> {
  try {
    await mkdir(config.paths.dataDir, {
      recursive: true,
      mode: config.storage.directoryMode,
    });
    if (!db) {
      db = new Database(config.paths.databaseFile);
      db.run("PRAGMA foreign_keys = ON");
      await applyMigrations(db);
    }
    return db;
  } catch {
    return null;
  }
}

function getState(database: Database, key: string): string | null {
  const row = database
    .query("SELECT value FROM app_state WHERE key = ?")
    .get(key) as { value: string } | null;
  return row?.value ?? null;
}

function setState(database: Database, key: string, value: string): void {
  database
    .query(`
      INSERT INTO app_state (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    .run(key, value);
}

function saveSessionInDb(database: Database, session: PersistedSession): void {
  database.transaction((sessionToSave: PersistedSession) => {
    const tokens = normalizeTokens(sessionToSave.cumulativeTokens);
    const now = new Date().toISOString();
    const updatedAt = sessionToSave.timestamp ?? now;

    database
      .query(`
        INSERT INTO sessions (
          id,
          title,
          model,
          conversation_summary,
          input_tokens,
          output_tokens,
          total_tokens,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          model = excluded.model,
          conversation_summary = excluded.conversation_summary,
          input_tokens = excluded.input_tokens,
          output_tokens = excluded.output_tokens,
          total_tokens = excluded.total_tokens,
          updated_at = excluded.updated_at
      `)
      .run(
        sessionToSave.id,
        sessionToSave.title,
        sessionToSave.model ?? null,
        sessionToSave.conversationSummary ?? "",
        tokens.input,
        tokens.output,
        tokens.total,
        now,
        updatedAt,
      );

    database.query("DELETE FROM messages WHERE session_id = ?").run(sessionToSave.id);
    database.query("DELETE FROM tool_calls WHERE session_id = ?").run(sessionToSave.id);

    const insertMessage = database.query(`
      INSERT INTO messages (session_id, role, content, order_index, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    sessionToSave.messages.forEach((message, index) => {
      insertMessage.run(sessionToSave.id, message.role, message.content, index, now);
    });

    const insertToolCall = database.query(`
      INSERT INTO tool_calls (
        id,
        session_id,
        assistant_message_index,
        name,
        args_json,
        result_json,
        status,
        timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    sessionToSave.toolCalls.forEach((toolCall) => {
      insertToolCall.run(
        toolCall.id,
        sessionToSave.id,
        toolCall.assistantMessageIndex,
        toolCall.name,
        JSON.stringify(toolCall.args ?? {}),
        toolCall.result === undefined ? null : JSON.stringify(toolCall.result),
        toolCall.status,
        toolCall.timestamp.toISOString(),
      );
    });
  })(session);
}

function readSession(database: Database, sessionId: string): PersistedSession | null {
  const session = database
    .query("SELECT * FROM sessions WHERE id = ?")
    .get(sessionId) as SessionRow | null;
  if (!session) return null;

  const messages = database
    .query(`
      SELECT role, content
      FROM messages
      WHERE session_id = ?
      ORDER BY order_index ASC
    `)
    .all(sessionId) as MessageRow[];

  const toolCalls = database
    .query(`
      SELECT *
      FROM tool_calls
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `)
    .all(sessionId) as ToolCallRow[];

  return toPersistedSession(
    session,
    messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    toolCalls.map(reviveToolCall),
  );
}

export async function createSession(model?: string): Promise<PersistedSession | null> {
  const database = await getDb();
  if (!database) return null;

  const id = generateSessionId();
  const now = new Date().toISOString();
  const session: PersistedSession = {
    id,
    title: `Session ${new Date().toLocaleString()}`,
    messages: [],
    toolCalls: [],
    timestamp: now,
    model,
    conversationSummary: "",
    cumulativeTokens: { ...EMPTY_TOKENS },
  };

  try {
    saveSessionInDb(database, session);
    setState(database, "current_session_id", id);
    return session;
  } catch {
    return null;
  }
}

export async function listSessions(): Promise<SessionMeta[]> {
  const database = await getDb();
  if (!database) return [];

  const rows = database
    .query(`
      SELECT
        s.id,
        s.title,
        s.updated_at AS timestamp,
        s.model,
        COUNT(m.id) AS message_count
      FROM sessions s
      LEFT JOIN messages m ON m.session_id = s.id
      GROUP BY s.id
      ORDER BY s.updated_at DESC
    `)
    .all() as SessionMetaRow[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    timestamp: row.timestamp,
    messageCount: Number(row.message_count),
    ...(row.model ? { model: row.model } : {}),
  }));
}

export async function saveSession(
  sessionId: string,
  messages: Message[],
  toolCalls: ToolCall[],
  model?: string,
  conversationSummary?: string,
  cumulativeTokens?: TokenTotals,
  title?: string,
): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const existing = readSession(database, sessionId);
  const session: PersistedSession = {
    id: sessionId,
    title: title ?? existing?.title ?? deriveTitle(messages, sessionId),
    messages,
    toolCalls,
    timestamp: new Date().toISOString(),
    model,
    conversationSummary: conversationSummary ?? existing?.conversationSummary ?? "",
    cumulativeTokens: normalizeTokens(cumulativeTokens ?? existing?.cumulativeTokens),
  };

  try {
    saveSessionInDb(database, session);
    setState(database, "current_session_id", sessionId);
  } catch {
    // Session persistence is best-effort.
  }
}

export async function loadSession(sessionId?: string): Promise<PersistedSession | null> {
  const database = await getDb();
  if (!database) return null;

  if (sessionId) {
    const session = readSession(database, sessionId);
    if (session) setState(database, "current_session_id", session.id);
    return session;
  }

  const current = getState(database, "current_session_id");
  if (current) {
    const session = readSession(database, current);
    if (session) return session;
  }

  const latest = database
    .query("SELECT id FROM sessions ORDER BY updated_at DESC LIMIT 1")
    .get() as { id: string } | null;

  if (!latest) return null;
  const session = readSession(database, latest.id);
  if (session) setState(database, "current_session_id", session.id);
  return session;
}

export async function clearSession(sessionId: string): Promise<void> {
  const database = await getDb();
  if (!database) return;

  const existing = readSession(database, sessionId);
  await saveSession(
    sessionId,
    [],
    [],
    existing?.model,
    "",
    { ...EMPTY_TOKENS },
    existing?.title,
  );
}
