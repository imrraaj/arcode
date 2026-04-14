import {
  type LanguageModelUsage,
  type ToolApprovalResponse,
  stepCountIs,
  streamText,
} from "ai";
import { nvidia } from "./provider";
import { config } from "./utils/config";
import {
  prepareMessages,
  compactMemoryTool,
  shouldCompact,
  DEFAULT_MEMORY_CONFIG,
} from "./context/memory";
import { webSearchTool } from "./tools/websearch";
import { createFileTool, readFileTool, subAgentTool, writeFileTool } from "./tools";
import {
  discoverSkills,
  discoverSkillsTool,
  loadSkillTool,
  sdbx,
} from "./tools/skill";
import { grepTool } from "./tools/grep";
import { runCommandTool } from "./tools/command";
import type { Message, ToolCall } from "./types";

type StateUpdate<T> = T | ((prev: T) => T);

interface RunAgentTurnOptions {
  prompt: string;
  messages: Message[];
  messagesWithPrompt: Message[];
  selectedModel: string;
  conversationSummary: string;
  abortSignal?: AbortSignal;
  askUserApproval: (toolName: string, args: Record<string, any>) => Promise<boolean>;
  onMessagesChange: (update: StateUpdate<Message[]>) => void;
  onToolCallsChange: (update: StateUpdate<ToolCall[]>) => void;
  onStreamText: (text: string) => void;
  onCompactingChange: (isCompacting: boolean) => void;
  onConversationSummary: (summary: string) => void;
  onUsage: (usage: LanguageModelUsage | undefined) => void;
}

function isAbortError(error: any): boolean {
  return (
    error?.name === "AbortError" ||
    error?.message?.includes("abort") ||
    (error?.cause && error.cause.name === "AbortError")
  );
}

function toModelMessages(messages: Message[]) {
  return messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
}

function removeCompactionMessage(messages: Message[]): Message[] {
  const last = messages.at(-1);
  if (last?.role === "assistant" && last.content === "Compacting memory...") {
    return messages.slice(0, -1);
  }
  return messages;
}

export async function runAgentTurn({
  prompt,
  messages,
  messagesWithPrompt,
  selectedModel,
  conversationSummary,
  abortSignal,
  askUserApproval,
  onMessagesChange,
  onToolCallsChange,
  onStreamText,
  onCompactingChange,
  onConversationSummary,
  onUsage,
}: RunAgentTurnOptions): Promise<void> {
  const assistantMessageIndex = messagesWithPrompt.length;
  const needsCompaction = shouldCompact(messages, DEFAULT_MEMORY_CONFIG, prompt);

  let messagesToSend: any[] = toModelMessages(messagesWithPrompt);

  if (conversationSummary) {
    messagesToSend = [
      {
        role: "system",
        content: `[Earlier Conversation Summary]: ${conversationSummary}`,
      },
      ...messagesToSend,
    ];
  }

  if (needsCompaction) {
    onCompactingChange(true);
    onMessagesChange((prev) => [
      ...prev,
      { role: "assistant", content: "Compacting memory..." },
    ]);

    try {
      const prepared = await prepareMessages(
        messages,
        DEFAULT_MEMORY_CONFIG,
        nvidia(selectedModel),
        abortSignal
      );

      messagesToSend = toModelMessages(prepared.messages);

      if (prepared.summary) {
        onConversationSummary(prepared.summary);
      }
    } catch (error: any) {
      if (isAbortError(error)) return;
      console.error("Memory compaction failed:", error);
    } finally {
      onMessagesChange(removeCompactionMessage);
      onCompactingChange(false);
    }
  }

  try {
    while (true) {
      const result = streamText({
        model: nvidia(selectedModel),
        system: config.systemPrompt,
        messages: messagesToSend,
        stopWhen: stepCountIs(5),
        abortSignal,
        tools: {
          web_search: webSearchTool,
          subagent: subAgentTool,
          load_skill: loadSkillTool,
          discoverSkills: discoverSkillsTool,
          grep: grepTool,
          run_command: runCommandTool,
          compact_memory: compactMemoryTool,
          read_file: readFileTool,
          write_file: writeFileTool,
          create_file: createFileTool,
        },
        experimental_context: {
          sandbox: sdbx,
          skills: await discoverSkills(sdbx, [".agents"]),
        },
        onFinish: ({ usage }) => onUsage(usage),
      });

      let fullText = "";
      for await (const chunk of result.textStream) {
        fullText += chunk;
        onStreamText(fullText);
      }

      const [content, response] = await Promise.all([
        result.content,
        result.response,
      ]);

      const approvalRequests = content.filter(
        (p) => p.type === "tool-approval-request"
      );

      if (approvalRequests.length === 0) {
        onMessagesChange((prev) => [
          ...prev,
          { role: "assistant", content: fullText },
        ]);
        onToolCallsChange((prev) =>
          prev.map((tc) =>
            tc.assistantMessageIndex === -1
              ? { ...tc, assistantMessageIndex }
              : tc
          )
        );
        onStreamText("");
        break;
      }

      onStreamText("");

      const pendingToolCalls: ToolCall[] = approvalRequests.map((req) => {
        const r = req as any;
        return {
          id: r.approvalId,
          assistantMessageIndex: -1,
          name: r.toolCall.toolName,
          args: r.toolCall.input,
          status: "pending" as const,
          timestamp: new Date(),
        };
      });
      onToolCallsChange((prev) => [...prev, ...pendingToolCalls]);

      const approvals: ToolApprovalResponse[] = [];
      for (const req of approvalRequests) {
        const r = req as any;
        const approved = await askUserApproval(
          r.toolCall.toolName,
          r.toolCall.input
        );

        onToolCallsChange((prev) =>
          prev.map((tc) =>
            tc.id === r.approvalId
              ? { ...tc, status: approved ? "approved" : "denied" }
              : tc
          )
        );

        if (approved) {
          onToolCallsChange((prev) =>
            prev.map((tc) =>
              tc.id === r.approvalId
                ? { ...tc, status: "running" as const }
                : tc
            )
          );
        }

        approvals.push({
          type: "tool-approval-response",
          approvalId: r.approvalId,
          approved,
        });
      }

      messagesToSend = [
        ...messagesToSend,
        ...(response.messages as any[]),
        { role: "tool", content: approvals },
      ];

      onToolCallsChange((prev) =>
        prev.map((tc) =>
          tc.status === "running" ? { ...tc, status: "completed" } : tc
        )
      );
    }
  } catch (error: any) {
    const content = isAbortError(error)
      ? "Generation cancelled."
      : `Error: ${error?.message || "Failed to reach LLM"}`;

    onMessagesChange((prev) => [
      ...prev,
      { role: "assistant", content },
    ]);
    onToolCallsChange((prev) =>
      prev.map((tc) =>
        tc.assistantMessageIndex === -1
          ? { ...tc, assistantMessageIndex }
          : tc
      )
    );
  }
}
