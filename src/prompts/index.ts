import { readFileSync } from "fs";

function readPrompt(filename: string): string {
  return readFileSync(new URL(filename, import.meta.url), "utf-8").trim();
}

const systemPrompt = readPrompt("./system.md");
const subAgentPrompt = readPrompt("./subagent.md");
const summarizeSystemPrompt = readPrompt("./summarizer-system.md");
const summarizeUserPrompt = readPrompt("./summarizer-user.md");

function buildSummarizeUserPrompt(conversationText: string): string {
  return summarizeUserPrompt.replace("{{conversationText}}", conversationText);
}

export const prompts = {
  system: systemPrompt,
  subAgent: subAgentPrompt,
  summarizeSystem: summarizeSystemPrompt,
  summarizeUser: buildSummarizeUserPrompt,
} as const;

export {
  buildSummarizeUserPrompt,
  subAgentPrompt,
  summarizeSystemPrompt,
  systemPrompt,
};
