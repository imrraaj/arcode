import { useState, useEffect, useCallback } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import { stepCountIs, streamText, tool } from "ai";
import { nvidia } from "./provider";
import z from "zod";
import { openai } from "@ai-sdk/openai";
import { tavily } from "@tavily/core";
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY,  });


const MODEL = "qwen/qwen3.5-122b-a10b";

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
  if (msg.role === "user") {
    return (
      <Box marginTop={1} marginBottom={0}>
        <Text bold color="magenta">
          {"  YOU "}
        </Text>
        <Text dimColor>│ </Text>
        <Text>{msg.content}</Text>
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
        <Text>{msg.content}</Text>
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

function StatusBar({ model, msgCount }: { model: string; msgCount: number }) {
  const width = process.stdout.columns || 80;
  const left = ` forge v0.1.0 │ ${model}`;
  const right = `${msgCount} messages │ ctrl+c to exit `;
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
  const rows = process.stdout.rows || 24;
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
          // system: "SYSTEM_PROMPT",
          messages: newMessages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          stopWhen: stepCountIs(5),
          tools: {
            web_search: tool({
              description: "Search the web for current information. Use when the user asks about recent events, news, or anything you don't know.",
              inputSchema: z.object({
                query: z.string().describe("The search query"),
              }),
              execute: async ({ query }) => {
                const result = await tvly.search(query, { includeAnswer:"basic", searchDepth:"advanced" });
                return result.results
                  .map((r) => `**${r.title}**\n${r.url}\n${r.content}`)
                  .join("\n\n---\n\n");
              },
            }),
            read_file: tool({
              description: "Reads the content of a file given its path. Usage: read_file(path: string)",
              inputSchema: z.object({
                path: z.string(),
              }),
              execute: async ({ path }) => {
                if (path.includes("..")) {
                  throw new Error("Access denied");
                }
                const fs = await import("fs/promises");
                const fullPath = `${process.cwd()}/${path}`;
                return await fs.readFile(fullPath, "utf-8");
              },
            }),
            write_file: tool({
              description: "Writes content to a file given its path. Usage: write_file(path: string, content: string)",
              inputSchema: z.object({ path: z.string(), content: z.string() }),
              execute: async ({ path, content }) => {
                if (path.includes("..")) {
                  throw new Error("Access denied");
                }
                const fs = await import("fs/promises");
                const fullPath = `${process.cwd()}/${path}`;
                await fs.writeFile(fullPath, content, "utf-8");
                return `File ${path} written successfully.`;
              },
            }),
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
    <Box flexDirection="column" width="100%" height={rows}>

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
        {messages.map((msg, i) => (
          <MessageView key={i} msg={msg} />
        ))}

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
              <Text>{streamText_}</Text>
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

      <StatusBar model={MODEL} msgCount={messages.length} />
    </Box>
  );
}

console.clear();
render(<App />);