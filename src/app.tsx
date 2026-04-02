import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import {
  LanguageModelUsage,
  ToolApprovalResponse,
  stepCountIs,
  streamText,
} from "ai";
import { nvidia } from "./provider";
import { webSearchTool } from "./tools/websearch";
import { subAgentTool } from "./tools";
import {
  discoverSkills,
  discoverSkillsTool,
  loadSkillTool,
  sdbx,
} from "./tools/skill";
import { grepTool } from "./tools/grep";
import { runCommandTool } from "./tools/command";
import { theme } from "./theme";

import { Message } from "./ui/MessageView";
import { ScrollableMessageList } from "./ui/ScrollableMessageList";
import { Spinner } from "./ui/Spinner";
import { StatusBar } from "./ui/StatusBar";
import { InputBox } from "./ui/InputBox";
import { ApprovalPrompt } from "./ui/ApprovalPrompt";
import { CommandPalette } from "./ui/CommandPalette";
import { WelcomeScreen } from "./ui/WelcomeScreen";
import { ToolCallView, type ToolCall } from "./ui/ToolCallView";
import { useMouseWheel } from "./hooks/useMouseWheel";
import { config } from "./utils/config";
import {
  prepareMessages,
  compactMemoryTool,
  calculateTotalTokens,
  shouldCompact,
  DEFAULT_MEMORY_CONFIG,
  loadStoredMemory,
  estimateTokens,
} from "./context/memory";

export function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [input, setInput] = useState("");
  const [cursor, setCursor] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText_, setStreamText] = useState("");
  const [showWelcome, setShowWelcome] = useState(true);
  const [sessionUsage, setSessionUsage] = useState<LanguageModelUsage>();
  const [cumulativeTokens, setCumulativeTokens] = useState<{ input: number; output: number; total: number }>({ input: 0, output: 0, total: 0 });
  const [selectedModel, setSelectedModel] = useState(config.defaultModel);
  const [showPalette, setShowPalette] = useState(false);
  const [messageScrollOffset, setMessageScrollOffset] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [conversationSummary, setConversationSummary] = useState<string>("");
  const [isCompacting, setIsCompacting] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  const [pendingApproval, setPendingApproval] = useState<{
    toolName: string;
    args: Record<string, any>;
    resolve: (approved: boolean) => void;
  } | null>(null);

  const askUserApproval = (toolName: string, args: any): Promise<boolean> =>
    new Promise((resolve) =>
      setPendingApproval({ toolName, args, resolve }),
    );

  useInput(
    (_, key) => {
      if (key.escape && !showPalette && !pendingApproval) {
        if ((streaming || isCompacting) && abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        } else if (!streaming && !isCompacting) {
          exit();
        }
        return;
      }

      if (!showPalette && !pendingApproval && key.upArrow) {
        setMessageScrollOffset((prev) =>
          Math.min(messages.length, prev + 1),
        );
        return;
      }

      if (!showPalette && !pendingApproval && key.downArrow) {
        setMessageScrollOffset((prev) => Math.max(0, prev - 1));
        return;
      }

      if (!showPalette && !pendingApproval && key.pageUp) {
        setMessageScrollOffset((prev) =>
          Math.min(messages.length, prev + 5),
        );
        return;
      }

      if (!showPalette && !pendingApproval && key.pageDown) {
        setMessageScrollOffset((prev) => Math.max(0, prev - 5));
        return;
      }

      if (!showPalette && !pendingApproval && key.home) {
        setMessageScrollOffset(messages.length);
        return;
      }

      if (!showPalette && !pendingApproval && key.end) {
        setMessageScrollOffset(0);
      }
    },
    { isActive: !showPalette && !pendingApproval },
  );

  // Load stored memory on startup
  useEffect(() => {
    loadStoredMemory().then((stored) => {
      if (stored?.summary) {
        setConversationSummary(stored.summary);
      }
    });
  }, []);

  // Mouse wheel scrolling for messages
  // Wheel up = scroll up = show older messages = increase offset
  // Wheel down = scroll down = show newer messages = decrease offset
  useMouseWheel(
    {
      onScrollUp: () => {
        if (!showPalette && !pendingApproval) {
          setMessageScrollOffset((prev) =>
            Math.min(messages.length, prev + 3),
          );
        }
      },
      onScrollDown: () => {
        if (!showPalette && !pendingApproval) {
          setMessageScrollOffset((prev) => Math.max(0, prev - 3));
        }
      },
    },
    !showPalette && !pendingApproval,
  );

  useEffect(() => {
    setMessageScrollOffset(0);
  }, [messages.length, streaming]);

  const handleSubmit = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || streaming || isCompacting) return;

      setShowWelcome(false);
      const userMsg: Message = { role: "user", content: prompt.trim() };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInput("");
      setCursor(0);
      setStreaming(true);
      setStreamText("");
      
      // Clear old tool calls when starting a new message
      setToolCalls([]);

      abortControllerRef.current = new AbortController();

      // Memory management: Check if compaction is needed
      const totalTokens = calculateTotalTokens(messages) + estimateTokens(prompt);
      const needsCompaction = shouldCompact(messages, DEFAULT_MEMORY_CONFIG, prompt);

      let messagesToSend: any[] = newMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Add summary from previous session if exists
      if (conversationSummary) {
        messagesToSend = [
          { role: "system", content: `[Earlier Conversation Summary]: ${conversationSummary}` },
          ...messagesToSend,
        ];
      }

      // If near context limit, compact memory
      if (needsCompaction) {
        setIsCompacting(true);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Compacting memory..." },
        ]);

        try {
          const prepared = await prepareMessages(
            messages,
            DEFAULT_MEMORY_CONFIG,
            nvidia(selectedModel),
            abortControllerRef.current.signal
          );

          messagesToSend = prepared.messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

          if (prepared.summary) {
            setConversationSummary(prepared.summary);
          }

          // Remove the "Compacting..." message and replace with result
          setMessages((prev) => prev.slice(0, -1));
        } catch (err: any) {
          // If abort, don't update messages
          if (err?.name === "AbortError") {
            setIsCompacting(false);
            return;
          }
          // On error, continue with full messages
          console.error("Memory compaction failed:", err);
        } finally {
          setIsCompacting(false);
        }
      }

      try {
        while (true) {
          const result = streamText({
            model: nvidia(selectedModel),
            system: config.systemPrompt,
            messages: messagesToSend,
            stopWhen: stepCountIs(5),
            abortSignal: abortControllerRef.current?.signal,
            tools: {
              web_search: webSearchTool,
              subagent: subAgentTool,
              load_skill: loadSkillTool,
              discoverSkills: discoverSkillsTool,
              grep: grepTool,
              run_command: runCommandTool,
              compact_memory: compactMemoryTool,
            },
            experimental_context: {
              sandbox: sdbx,
              skills: await discoverSkills(sdbx, [".agents"]),
            },
            onFinish: ({ usage }) => {
              setSessionUsage(usage);
              setCumulativeTokens((prev) => ({
                input: prev.input + (usage?.inputTokens ?? 0),
                output: prev.output + (usage?.outputTokens ?? 0),
                total: prev.total + (usage?.totalTokens ?? 0),
              }));
            },
          });

          let fullText = "";
          for await (const chunk of result.textStream) {
            fullText += chunk;
            setStreamText(fullText);
          }

          const [content, response] = await Promise.all([
            result.content,
            result.response,
          ]);
        const approvalRequests = content.filter(
          (p) => p.type === "tool-approval-request",
        );

        if (approvalRequests.length === 0) {
          const newIndex = messages.length;
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: fullText },
          ]);
          // Associate pending tool calls with this message
          setToolCalls((prev) =>
            prev.map((tc) =>
              tc.assistantMessageIndex === -1
                ? { ...tc, assistantMessageIndex: newIndex }
                : tc
            )
          );
          setStreamText("");
          break;
        }

        setStreamText("");

        // Add pending tool calls to UI
        const pendingToolCalls: ToolCall[] = approvalRequests.map((req) => {
          const r = req as any;
          return {
            id: r.approvalId,
            assistantMessageIndex: -1, // Will be set when assistant message is added
            name: r.toolCall.toolName,
            args: r.toolCall.input,
            status: "pending" as const,
            timestamp: new Date(),
          };
        });
        setToolCalls((prev) => [...prev, ...pendingToolCalls]);

        const approvals: ToolApprovalResponse[] = [];
        for (const req of approvalRequests) {
          const r = req as any;
          
          // Update tool call status to approved/denied
          const approved = await askUserApproval(
            r.toolCall.toolName,
            r.toolCall.input,
          );
          
          // Update tool call status in state
          setToolCalls((prev) =>
            prev.map((tc) =>
              tc.id === r.approvalId
                ? { ...tc, status: approved ? "approved" : "denied" }
                : tc
            )
          );

          // If approved, mark as running
          if (approved) {
            setToolCalls((prev) =>
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
        
        // Mark all running tool calls as completed after the loop iteration
        setToolCalls((prev) =>
          prev.map((tc) =>
            tc.status === "running" ? { ...tc, status: "completed" } : tc
          )
        );
      }
        } catch (err: any) {
        const isAbortError = err?.name === "AbortError" || 
          err?.message?.includes("abort") ||
          (err?.cause && (err?.cause as any)?.name === "AbortError");
        
        if (isAbortError) {
          const newIndex = messages.length;
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Generation cancelled." },
          ]);
          setToolCalls((prev) =>
            prev.map((tc) =>
              tc.assistantMessageIndex === -1
                ? { ...tc, assistantMessageIndex: newIndex }
                : tc
            )
          );
        } else {
          const newIndex = messages.length;
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `Error: ${err?.message || "Failed to reach LLM"}`,
            },
          ]);
          setToolCalls((prev) =>
            prev.map((tc) =>
              tc.assistantMessageIndex === -1
                ? { ...tc, assistantMessageIndex: newIndex }
                : tc
            )
          );
        }
      } finally {
        setStreaming(false);
        setStreamText("");
        abortControllerRef.current = null;
      }
    },
    [messages, selectedModel, streaming, conversationSummary, isCompacting],
  );

  const isInputActive = !showPalette && !pendingApproval;
  const rows = stdout.rows || process.stdout.rows || 24;
  const cols = stdout.columns || process.stdout.columns || 80;
  // Reserve rows for: input box (3) + status bar (1) + padding (1) + welcome if shown
  const reservedRows = showWelcome && messages.length === 0 ? 13 : 5;
  const availableRows = Math.max(5, rows - reservedRows);

  const streamingMessage =
    streaming && streamText_
      ? { role: "assistant" as const, content: streamText_ }
      : undefined;

  return (
    <Box width={cols} height={rows} backgroundColor={theme.bgDark}>
      <Box
        flexDirection="column"
        width={"80%"}
        height={"100%"}
        backgroundColor={theme.bgDark}
      >
        {showWelcome && messages.length === 0 && <Box height={"100%"}><WelcomeScreen /></Box>}

        {messages.length > 0 && (
          <Box paddingX={1}>
            <ScrollableMessageList
              messages={messages}
              toolCalls={toolCalls}
              scrollOffset={messageScrollOffset}
              maxHeight={availableRows}
              width={cols - 2}
              streamingMessage={streamingMessage}
            />
          </Box>
        )}

        <Box
          flexDirection="column"
          justifyContent="space-between"
          gap={2}
          backgroundColor={theme.bg}
          padding={1}
          margin={1}
        >
          <InputBox
            value={input}
            cursor={cursor}
            onChange={(nextValue, nextCursor) => {
              setInput(nextValue);
              setCursor(nextCursor);
            }}
            onSubmit={handleSubmit}
            onCommandPalette={() => setShowPalette(true)}
            placeholder="Ask anything..."
            isActive={isInputActive}
          />

          <Box gap={1}>
            <Text bold dimColor>{selectedModel}</Text>
            {streaming && <Spinner label="Generating..." />}
          </Box>
        </Box>
      </Box>

      <Box
        width={"20%"}
        height={"100%"}
        backgroundColor={theme.bg}
        paddingX={2}
        paddingY={1}
      >
          <StatusBar
            model={selectedModel}
            msgCount={messages.length}
            cumulativeTokens={cumulativeTokens}
          />
      </Box>

      {showPalette && (
        <Box
          position="absolute"
          width={cols}
          height={rows}
          justifyContent="center"
          alignItems="center"
        >
          <CommandPalette
            sessionUsage={sessionUsage}
            onClose={() => setShowPalette(false)}
            onChangeModel={(model: string) =>
              setSelectedModel(model)
            }
            onClearHistory={() => {
              setMessages([]);
              setInput("");
              setCursor(0);
              setShowWelcome(true);
            }}
          />
        </Box>
      )}

      {pendingApproval && (
        <Box
          position="absolute"
          width={cols}
          height={rows}
          justifyContent="center"
          alignItems="center"
        >
          <ApprovalPrompt
            toolName={pendingApproval.toolName}
            args={pendingApproval.args}
            isActive={Boolean(pendingApproval)}
            onRespond={(approved: boolean) => {
              pendingApproval.resolve(approved);
              setPendingApproval(null);
            }}
          />
        </Box>
      )}
    </Box>
  );
}
