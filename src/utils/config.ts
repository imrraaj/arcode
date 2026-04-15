import { homedir } from "os";
import { join } from "path";
import { WORKSPACE_ROOT } from "@/utils/workspace";

const arcHomeDir = join(homedir(), ".arc");
const arcSessionsDir = join(arcHomeDir, "sessions");
const arcSettingsFile = join(arcHomeDir, "config.json");
const arcMemoryFile = join(arcHomeDir, "memory.json");
const arcCurrentSessionFile = join(arcHomeDir, "current-session.json");

const availableModels = [
    "qwen/qwen3.5-122b-a10b",
    "moonshotai/kimi-k2.5",
    "z-ai/glm5",
    "minimaxai/minimax-m2.7",
] as const;

const systemPrompt = `You are Arc, an expert coding assistant running inside a CLI terminal. You help users understand, write, debug, and refactor code. Keep responses concise and well-formatted. Use markdown for code blocks. When showing code, always specify the language for syntax highlighting. Be direct — no fluff.`;
const subAgentPrompt = `You are a helpful sub-agent assisting the main assistant in performing a specific task. You will be given a clear instruction and should provide a concise response that directly addresses the task. Keep your response focused and to the point.`;

export const config = {
    appName: "arc",
    version: "0.2.0",
    defaultModel: availableModels[0],
    availableModels,

    paths: {
        dataDir: arcHomeDir,
        sessionsDir: arcSessionsDir,
        settingsFile: arcSettingsFile,
        memoryFile: arcMemoryFile,
        currentSessionFile: arcCurrentSessionFile,
    },

    storage: {
        directoryMode: 0o700,
        settingsFileMode: 0o600,
    },

    memory: {
        windowSize: 10,
        contextWindow: 32000,
        safetyBuffer: 2000,
        compactionThreshold: 0.9,
    },

    ui: {
        modelContextWindow: 32768,
        apiKeyStorageLabel: "~/.arc/config.json",
    },

    prompts: {
        system: systemPrompt,
        subAgent: subAgentPrompt,
        summarizeSystem: `You are a conversation summarizer. Your task is to summarize the given conversation concisely while preserving key information.
Focus on capturing:
1. What the user asked or requested
2. What actions were taken or tools used
3. Important results, decisions, or conclusions
4. Any context that would be needed to understand future messages

Be concise but comprehensive. Use bullet points if helpful.`,
        summarizeUser: (conversationText: string) =>
            `Summarize this conversation concisely:\n\n${conversationText}\n\nProvide a summary that captures the key points, decisions, and context.`,
    },

    tools: {
        command: {
            maxOutputBytes: 50_000,
            defaultTimeoutSeconds: 30,
            maxTimeoutSeconds: 120,
            blockedPatterns: [
                /rm\s+(-[a-z]*r[a-z]*f[a-z]*|-[a-z]*f[a-z]*r[a-z]*)\s+\//i,
                /\bdd\b.*of=\/dev\//i,
                /\bmkfs\b/i,
                /\bshutdown\b|\breboot\b|\bhalt\b|\bpoweroff\b/i,
                /:\(\)\s*\{.*\|.*&.*\}/,
                /\bsudo\s+rm\b/i,
            ],
        },
        skills: {
            defaultDirectories: [join(WORKSPACE_ROOT, ".agents")],
        },
    },
} as const;
