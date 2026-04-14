import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKeyboard, useTerminalDimensions, useRenderer } from "@opentui/react";
import type { LanguageModelUsage } from "ai";
import { runAgentTurn } from "./agent";
import { theme, colors } from "./theme";
import { MessageView } from "./components/MessageView";
import { ToolCallView } from "./components/ToolCallView";
import { StatusBar } from "./components/StatusBar";
import { CommandPalette } from "./components/CommandPalette";
import { ApprovalPrompt } from "./components/ApprovalPrompt";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { config } from "./utils/config";
import { saveSession, loadSession, clearSession } from "./utils/persistence";
import { loadStoredMemory } from "./context/memory";
import type { Message, ToolCall, PendingApproval } from "./types";

export function App() {
  const renderer = useRenderer();
  const { width: termWidth, height: termHeight } = useTerminalDimensions();

  // State
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText_, setStreamText] = useState("");
  const [showWelcome, setShowWelcome] = useState(true);
  const [sessionUsage, setSessionUsage] = useState<LanguageModelUsage>();
  const [cumulativeTokens, setCumulativeTokens] = useState({
    input: 0,
    output: 0,
    total: 0,
  });
  const [selectedModel, setSelectedModel] = useState(config.defaultModel);
  const [showPalette, setShowPalette] = useState(false);
  const [messageScrollOffset, setMessageScrollOffset] = useState(0);
  const [conversationSummary, setConversationSummary] = useState("");
  const [isCompacting, setIsCompacting] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Derived values
  const isInputActive = !showPalette && !pendingApproval;
  const cols = termWidth || 80;
  const rows = termHeight || 24;
  const sidebarWidth = Math.max(25, Math.floor(cols * 0.2));
  const mainWidth = cols - sidebarWidth;
  const reservedRows = showWelcome && messages.length === 0 ? 13 : 6;
  const availableRows = Math.max(7, rows - reservedRows);

  // Tool approval helper
  const askUserApproval = useCallback(
    (toolName: string, args: any): Promise<boolean> =>
      new Promise((resolve) =>
        setPendingApproval({ toolName, args, resolve })
      ),
    []
  );

  // Load stored memory and persisted session on startup
  useEffect(() => {
    // Load memory summary
    loadStoredMemory().then((stored) => {
      if (stored?.summary) {
        setConversationSummary(stored.summary);
      }
    });

    // Load persisted session
    loadSession().then((session) => {
      if (session && session.messages.length > 0) {
        setMessages(session.messages);
        setToolCalls(session.toolCalls);
        if (session.model) {
          setSelectedModel(session.model);
        }
        setShowWelcome(false);
      }
    });
  }, []);

  // Auto-save session when messages or tool calls change
  useEffect(() => {
    if (messages.length > 0) {
      saveSession(messages, toolCalls, selectedModel);
    }
  }, [messages, toolCalls, selectedModel]);

  // Reset scroll when messages change
  useEffect(() => {
    setMessageScrollOffset(0);
  }, [messages.length, streaming]);

  // Keyboard handling - only when input is active
  useKeyboard((key) => {
    // Command palette toggle
    if (key.ctrl && key.name === "k" && !showPalette && !pendingApproval) {
      setShowPalette(true);
      return;
    }

    // Escape handling
    if (key.name === "escape" && !showPalette && !pendingApproval) {
      if ((streaming || isCompacting) && abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      } else if (!streaming && !isCompacting) {
        renderer.destroy();
        process.exit(0);
      }
      return;
    }

    // Scroll controls (only when not in modal)
    if (!showPalette && !pendingApproval) {
      if (key.name === "up") {
        setMessageScrollOffset((prev) => Math.min(messages.length, prev + 1));
        return;
      }
      if (key.name === "down") {
        setMessageScrollOffset((prev) => Math.max(0, prev - 1));
        return;
      }
      if (key.name === "pageup") {
        setMessageScrollOffset((prev) => Math.min(messages.length, prev + 5));
        return;
      }
      if (key.name === "pagedown") {
        setMessageScrollOffset((prev) => Math.max(0, prev - 5));
        return;
      }
      if (key.name === "home") {
        setMessageScrollOffset(messages.length);
        return;
      }
      if (key.name === "end") {
        setMessageScrollOffset(0);
        return;
      }
    }
  });

  // Handle submit
  const handleSubmit = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || streaming || isCompacting) return;

      setShowWelcome(false);
      const userMsg: Message = { role: "user", content: prompt.trim() };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInput("");
      setStreaming(true);
      setStreamText("");
      setToolCalls([]);

      abortControllerRef.current = new AbortController();

      try {
        await runAgentTurn({
          prompt: prompt.trim(),
          messages,
          messagesWithPrompt: newMessages,
          selectedModel,
          conversationSummary,
          abortSignal: abortControllerRef.current.signal,
          askUserApproval,
          onMessagesChange: setMessages,
          onToolCallsChange: setToolCalls,
          onStreamText: setStreamText,
          onCompactingChange: setIsCompacting,
          onConversationSummary: setConversationSummary,
          onUsage: (usage) => {
            setSessionUsage(usage);
            setCumulativeTokens((prev) => ({
              input: prev.input + (usage?.inputTokens ?? 0),
              output: prev.output + (usage?.outputTokens ?? 0),
              total: prev.total + (usage?.totalTokens ?? 0),
            }));
          },
        });
      } finally {
        setStreaming(false);
        setStreamText("");
        abortControllerRef.current = null;
      }
    },
    [messages, selectedModel, streaming, conversationSummary, isCompacting, askUserApproval]
  );

  // Get visible messages
  const visibleMessages = useMemo(() => {
    return messages.slice(-10); // Show last 10 messages
  }, [messages]);

  // Group tool calls by message index
  const toolCallsByMessageIndex = useMemo(() => {
    const map = new Map<number, ToolCall[]>();
    toolCalls.forEach((tc) => {
      const idx = tc.assistantMessageIndex;
      if (!map.has(idx)) map.set(idx, []);
      map.get(idx)!.push(tc);
    });
    return map;
  }, [toolCalls]);

  // Streaming message
  const streamingMessage =
    streaming && streamText_
      ? { role: "assistant" as const, content: streamText_ }
      : undefined;

  return (
    <box
      width={cols}
      height={rows}
      backgroundColor={colors.bgDark}
      flexDirection="row"
    >
      <box
        width={mainWidth}
        height="100%"
        backgroundColor={colors.bgDark}
        flexDirection="column"
      >
        {/* Welcome screen or messages */}
        {showWelcome && messages.length === 0 ? (
          <WelcomeScreen />
        ) : (
          <box width="100%" flexGrow={1} paddingX={1} paddingY={1}>
            <scrollbox
              width={mainWidth - 2}
              height={availableRows}
              scrollY={true}
              stickyScroll={true}
              stickyStart="bottom"
              viewportCulling={true}
            >
              {/* Orphan tool calls (running) */}
              {toolCalls
                .filter((tc) => tc.assistantMessageIndex === -1)
                .map((tc) => (
                  <ToolCallView key={tc.id} toolCall={tc} />
                ))}

              {/* Messages */}
              {visibleMessages.map((msg, i) => {
                const actualIndex = messages.length - visibleMessages.length + i;
                return (
                  <box key={`${actualIndex}-${msg.role}`} flexDirection="column" marginY={0.5}>
                    <MessageView msg={msg} width={mainWidth - 4} />
                    {msg.role === "assistant" &&
                      toolCallsByMessageIndex.get(actualIndex)?.map((tc) => (
                        <ToolCallView key={tc.id} toolCall={tc} />
                      ))}
                  </box>
                );
              })}

              {/* Streaming message */}
              {streamingMessage && (
                <MessageView msg={streamingMessage} width={mainWidth - 4} isStreaming={true} />
              )}
            </scrollbox>
          </box>
        )}

        <box
          // width="100%"
          width={mainWidth -2 }
          flexDirection="column"
          backgroundColor={colors.bg}
          paddingX={2}
          marginX={1}
          border={["left"]}
          borderStyle="heavy"
          borderColor={theme.purple}
        >
          <box width="100%" flexDirection="row" height={3} justifyContent="center" alignItems="center">
            <text>
              <strong fg={theme.purple}>❯ </strong>
            </text>
            <input
              placeholder="Ask anything..."
              value={input}
              onInput={setInput}
              onSubmit={() => handleSubmit(input)}
              focused={isInputActive}
              width={"100%"}
              backgroundColor={colors.bg}
              textColor={colors.fg}
              cursorColor={colors.purple}
            />
          </box>

          <box width="100%" flexDirection="row" gap={1} paddingBottom={1}>
            <text><strong fg={theme.blue}>{selectedModel}</strong></text>
            {streaming && (
              <text fg={theme.comment}>⏳ Generating...</text>
            )}
          </box>
        </box>
      </box>

      {/* Sidebar */}
      <box
        width={sidebarWidth}
        height="100%"
        backgroundColor={colors.bg}
        paddingX={2}
        paddingY={1}
      >
        <StatusBar
          model={selectedModel}
          msgCount={messages.length}
          cumulativeTokens={cumulativeTokens}
        />
      </box>

      {/* Modals */}
      {showPalette && (
        <box
          position="absolute"
          width={cols}
          height={rows}
          justifyContent="center"
          alignItems="center"
          zIndex={100}
        >
          <CommandPalette
            sessionUsage={sessionUsage}
            onClose={() => setShowPalette(false)}
            onChangeModel={setSelectedModel}
            onClearHistory={() => {
              setMessages([]);
              setInput("");
              setShowWelcome(true);
            }}
            onClearSaved={() => {
              clearSession();
              setMessages([]);
              setToolCalls([]);
              setShowWelcome(true);
            }}
            onShowWelcome={() => {
              setShowWelcome(true);
            }}
          />
        </box>
      )}

      {pendingApproval && (
        <box
          position="absolute"
          width={cols}
          height={rows}
          justifyContent="center"
          alignItems="center"
          zIndex={100}
        >
          <ApprovalPrompt
            toolName={pendingApproval.toolName}
            args={pendingApproval.args}
            onRespond={(approved: boolean) => {
              pendingApproval.resolve(approved);
              setPendingApproval(null);
            }}
          />
        </box>
      )}
    </box>
  );
}
