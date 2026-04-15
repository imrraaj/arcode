import type { LanguageModelUsage } from "ai";
import { config } from "@/utils/config";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ToolCall {
  id: string;
  assistantMessageIndex: number;
  name: string;
  args: Record<string, any>;
  result?: any;
  status: "pending" | "approved" | "denied" | "running" | "completed" | "error";
  timestamp: Date;
}

// App state
export interface AppState {
  input: string;
  cursor: number;
  messages: Message[];
  streaming: boolean;
  streamText: string;
  showWelcome: boolean;
  sessionUsage?: LanguageModelUsage;
  cumulativeTokens: {
    input: number;
    output: number;
    total: number;
  };
  selectedModel: string;
  showPalette: boolean;
  messageScrollOffset: number;
  conversationSummary: string;
  isCompacting: boolean;
  toolCalls: ToolCall[];
  pendingApproval: PendingApproval | null;
}

export interface PendingApproval {
  toolName: string;
  args: Record<string, any>;
  resolve: (approved: boolean) => void;
}

// Command palette commands
export interface Command {
  id: string;
  label: string;
  description: string;
  action: () => void;
}

// Model options
export const AVAILABLE_MODELS = config.availableModels;

export type ModelId = (typeof AVAILABLE_MODELS)[number];

// Keyboard shortcuts
export interface Keybinding {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  description: string;
}

// export const KEYBINDINGS = {
//   submit: { key: "return", description: "Submit message" },
//   commandPalette: { key: "k", ctrl: true, description: "Open command palette" },
//   exit: { key: "escape", description: "Exit/cancel" },
//   scrollUp: { key: "up", description: "Scroll up" },
//   scrollDown: { key: "down", description: "Scroll down" },
//   pageUp: { key: "pageup", description: "Page up" },
//   pageDown: { key: "pagedown", description: "Page down" },
//   home: { key: "home", description: "Go to top" },
//   end: { key: "end", description: "Go to bottom" },
// } as const;
