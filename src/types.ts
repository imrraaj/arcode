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

export interface PendingApproval {
  toolName: string;
  args: Record<string, any>;
  resolve: (approved: boolean) => void;
}
