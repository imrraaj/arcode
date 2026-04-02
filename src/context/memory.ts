import { streamText, generateText } from "ai";
import { z } from "zod";
import { tool } from "ai";
import type { Message } from "../ui/MessageView.js";
import { saveMemory, loadMemory, clearMemory, hasStoredMemory, type StoredMemory } from "./storage.js";

export interface MemoryConfig {
  windowSize: number;
  contextWindow: number;
  safetyBuffer: number;
  compactionThreshold: number;
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  windowSize: 10,
  contextWindow: 32000,
  safetyBuffer: 2000,
  compactionThreshold: 0.9,
};

const MAX_TOKENS_FOR_SUMMARY = 8000;

const SUMMARIZE_SYSTEM_PROMPT = `You are a conversation summarizer. Your task is to summarize the given conversation concisely while preserving key information.

Focus on capturing:
1. What the user asked or requested
2. What actions were taken or tools used
3. Important results, decisions, or conclusions
4. Any context that would be needed to understand future messages

Be concise but comprehensive. Use bullet points if helpful.`;

const SUMMARIZE_USER_PROMPT = (messages: Message[]) => {
  const conversationText = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  return `Summarize this conversation concisely:\n\n${conversationText}\n\nProvide a summary that captures the key points, decisions, and context.`;
};

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function calculateTotalTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
}

export function shouldCompact(
  messages: Message[],
  config: MemoryConfig,
  pendingPrompt?: string
): boolean {
  const currentTokens = calculateTotalTokens(messages);
  const pendingTokens = pendingPrompt ? estimateTokens(pendingPrompt) : 0;
  const totalTokens = currentTokens + pendingTokens;
  const threshold = config.contextWindow * config.compactionThreshold;

  return totalTokens >= threshold;
}

export function splitMessages(
  messages: Message[],
  windowSize: number
): { older: Message[]; recent: Message[] } {
  if (messages.length <= windowSize) {
    return { older: [], recent: messages };
  }

  const recentCount = Math.min(windowSize, messages.length);
  const splitIndex = messages.length - recentCount;

  return {
    older: messages.slice(0, splitIndex),
    recent: messages.slice(splitIndex),
  };
}

export async function summarizeMessages(
  messages: Message[],
  model: any,
  signal?: AbortSignal
): Promise<string> {
  if (messages.length === 0) {
    return "";
  }

  try {
    const result = await generateText({
      model,
      system: SUMMARIZE_SYSTEM_PROMPT,
      prompt: SUMMARIZE_USER_PROMPT(messages),
      abortSignal: signal,
    });

    return result.text.trim();
  } catch (error: any) {
    if (error?.name === "AbortError" || error?.message?.includes("abort")) {
      throw error;
    }
    console.error("Failed to summarize messages:", error);
    return "[Summary unavailable - compaction failed]";
  }
}

export async function prepareMessages(
  messages: Message[],
  config: MemoryConfig,
  model: any,
  signal?: AbortSignal,
  forceCompact: boolean = false
): Promise<{
  messages: Message[];
  summary?: string;
  wasCompacted: boolean;
  needsCompaction: boolean;
}> {
  const needsCompaction = shouldCompact(messages, config) || forceCompact;

  if (!needsCompaction) {
    return {
      messages,
      wasCompacted: false,
      needsCompaction: false,
    };
  }

  const { older, recent } = splitMessages(messages, config.windowSize);

  let summary = "";

  if (older.length > 0) {
    summary = await summarizeMessages(older, model, signal);
  }

  const summaryMessage: Message = {
    role: "system",
    content: `[Earlier Conversation Summary]: ${summary}`,
  };

  const preparedMessages: Message[] = [
    summaryMessage,
    ...recent,
  ];

  if (summary) {
    await saveMemory(summary, recent);
  }

  return {
    messages: preparedMessages,
    summary,
    wasCompacted: true,
    needsCompaction: true,
  };
}

export async function loadStoredMemory(): Promise<{
  summary: string;
  recentMessages: Message[];
} | null> {
  const stored = await loadMemory();
  if (!stored) return null;

  return {
    summary: stored.summary,
    recentMessages: stored.recentMessages,
  };
}

export async function clearStoredMemory(): Promise<void> {
  await clearMemory();
}

export const compactMemoryTool = tool({
  description: "Manually compact memory when context window is getting full. Use when the conversation is becoming too long or when user requests compaction. This summarizes older messages and keeps recent ones for context.",
  inputSchema: z.object({
    force: z.boolean().optional().describe("Force compaction even if not at threshold"),
  }),
  needsApproval: false,
  execute: async ({ force }, { abortSignal }) => {
    return {
      shouldCompact: true,
      force: force || false,
      message: "Compaction requested. The system will now summarize older messages and keep recent ones.",
    };
  },
});
