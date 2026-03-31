import { useState, useEffect, useCallback } from "react";
import { render, Box, Text, useInput, useApp, Static } from "ink";
import { LanguageModelUsage, stepCountIs, streamText } from "ai";
import { nvidia } from "./provider";
import { webSearchTool } from "./tools/websearch";
import { subAgentTool } from "./tools";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

const MODEL = "qwen/qwen3.5-122b-a10b";

marked.setOptions({
  renderer: new TerminalRenderer() as any,
  gfm: true,
});

const normalizeMarkdown = (content: string): string => {
  return content
    .split("\n")
    .map((line) => line.replace(/^\s{4,}((?:[-*+]\s|\d+\.\s))/, "$1"))
    .join("\n");
};

const renderMarkdown = (content: string): string => {
  try {
    return String(marked.parse(normalizeMarkdown(content)));
  } catch {
    return content;
  }
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

// ─── Branding ────────────────────────────────────────────────────────────────

const LOGO = `
  ██████╗ ██████╗ ██████╗  ██████╗ ███████╗
  ██╔═══╝ ██╔══██╗██╔══██╗██╔════╝ ██╔════╝
  █████╗  ██║  ██║██████╔╝██║  ███╗█████╗
  ██╔══╝  ██║  ██║██╔══██╗██║   ██║██╔══╝
  ██║     ██████╔╝██║  ██║╚██████╔╝███████╗
  ╚═╝     ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝`;

const SYSTEM_PROMPT = `You are Forge, an expert coding assistant running inside a CLI terminal.
You help users understand, write, debug, and refactor code.
Keep responses concise and well-formatted. Use markdown for code blocks.
When showing code, always specify the language for syntax highlighting.
Be direct — no fluff.`;

// ─── Input Component ─────────────────────────────────────────────────────────

function TextInput({
  value,
  onChange,
  onSubmit,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  placeholder?: string;
}) {
  useInput((input, key) => {
    if (key.return) {
      onSubmit(value);
      return;
    }
    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      onChange(value + input);
    }
  });

  return (
    <Box>
      <Text bold color="magenta">
        {"❯ "}
      </Text>
      {value.length > 0 ? (
        <Text>{value}</Text>
      ) : (
        <Text dimColor>{placeholder || "Ask anything..."}</Text>
      )}
      <Text backgroundColor="magenta"> </Text>
    </Box>
  );
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageView({ msg }: { msg: Message }) {
  const renderedContent = msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content;

  if (msg.role === "user") {
    return (
      <Box marginTop={1} marginBottom={0}>
        <Text bold color="magenta">
          {"  YOU "}
        </Text>
        <Text dimColor>│ </Text>
        <Text>{renderedContent}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1} marginBottom={0}>
      <Box>
        <Text bold color="cyan">
          {"  ⚡ FORGE "}
        </Text>
        <Text dimColor>
          {"─".repeat(Math.max(0, (process.stdout.columns || 80) - 14))}
        </Text>
      </Box>
      <Box marginLeft={2} marginTop={0} paddingLeft={1} borderStyle="single" borderColor="gray" borderLeft borderTop={false} borderRight={false} borderBottom={false}>
        <Text>{renderedContent}</Text>
      </Box>
    </Box>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner({ label }: { label: string }) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const [i, setI] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setI((prev) => (prev + 1) % frames.length), 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box marginTop={1} marginLeft={2}>
      <Text color="yellow">{frames[i]} </Text>
      <Text dimColor italic>
        {label}
      </Text>
    </Box>
  );
}

// ─── Status Bar ──────────────────────────────────────────────────────────────

function StatusBar({ model, msgCount, sessionUsage }: { model: string; msgCount: number, sessionUsage?: LanguageModelUsage }) {
  const width = process.stdout.columns || 80;
  const left = ` forge v0.1.0 │ ${model}`;

  const right = `${msgCount} messages| Usage: ${sessionUsage ? ` ${sessionUsage.totalTokens} tokens` : "N/A"}`;
  const gap = Math.max(0, width - left.length - right.length);

  return (
    <Box>
      <Text backgroundColor="#1a1a2e" color="gray">
        {left + " ".repeat(gap) + right}
      </Text>
    </Box>
  );
}

function App() {
  const { exit } = useApp();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText_, setStreamText] = useState("");
  const [showWelcome, setShowWelcome] = useState(true);
  const [sessionUsage, setSessionUsage] = useState<LanguageModelUsage>();
  useInput((_, key) => {
    if (key.escape || (key.ctrl && _.toLowerCase() === "c")) {
      exit();
      process.exit(0);
    }
  });

  const handleSubmit = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || streaming) return;

      setShowWelcome(false);
      const userMsg: Message = { role: "user", content: prompt.trim() };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInput("");
      setStreaming(true);
      setStreamText("");

      try {
        const result = streamText({
          model: nvidia(MODEL),
          system: SYSTEM_PROMPT,
          messages: newMessages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          stopWhen: stepCountIs(5),
          tools: {
            web_search: webSearchTool,
            // read_file: readFileTool,
            // write_file: writeFileTool,
            // read_dir: readFileTool,
            // create_file: createFileTool,
            subagent: subAgentTool,
          },
          onFinish: ({ usage }) => {
            setSessionUsage(usage);
          }
        });

        let fullText = "";

        for await (const chunk of (await result).textStream) {
          fullText += chunk;
          setStreamText(fullText);
        }

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: fullText },
        ]);
        setStreamText("");
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error: ${err?.message || "Failed to reach LLM"}`,
          },
        ]);
      } finally {
        setStreaming(false);
      }
    },
    [messages, streaming]
  );

  return (
    <Box flexDirection="column" width="100%">

      <Box flexDirection="column" flexGrow={1}>

        {showWelcome && (
          <Box flexDirection="column" alignItems="center" marginTop={1}>
            <Text color="magenta">{LOGO}</Text>
            <Box marginTop={1}>
              <Text dimColor italic>
                Your AI-powered coding companion. Type anything to begin.
              </Text>
            </Box>
            <Box marginTop={0}>
              <Text dimColor>
                ─────────────────────────────────────────────
              </Text>
            </Box>
          </Box>
        )}

        {/* Messages */}
        <Static items={messages}>
          {(msg, i) => <MessageView key={i} msg={msg} />}
        </Static>

        {/* Streaming response */}
        {streaming && streamText_ && (
          <Box flexDirection="column" marginTop={1}>
            <Box>
              <Text bold color="cyan">
                {"  ⚡ FORGE "}
              </Text>
              <Text dimColor>
                {"─".repeat(Math.max(0, (process.stdout.columns || 80) - 14))}
              </Text>
            </Box>
            <Box marginLeft={2} paddingLeft={1} borderStyle="single" borderColor="cyan" borderLeft borderTop={false} borderRight={false} borderBottom={false}>
              <Text>{renderMarkdown(streamText_)}</Text>
            </Box>
          </Box>
        )}

        {/* Spinner */}
        {streaming && !streamText_ && <Spinner label="Forging a response..." />}

        {/* Input */}
        <Box marginTop={1} marginBottom={0}>
          {!streaming && (
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              placeholder="Ask anything... (esc to quit)"
            />
          )}
        </Box>
      </Box>

      <StatusBar model={MODEL} msgCount={messages.length} sessionUsage={sessionUsage} />
    </Box>
  );
}

console.clear();
render(<App />);