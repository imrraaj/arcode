import { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { LanguageModelUsage } from "ai";
import { theme } from "../theme";

const COMMANDS = [
  { id: "change-model", label: "Change Model", description: "Switch to a different AI model" },
  { id: "view-usage", label: "View Usage", description: "Show token usage statistics" },
  { id: "clear-history", label: "Clear History", description: "Reset conversation messages" },
] as const;

const MODELS = [
  "qwen/qwen3.5-122b-a10b",
  "meta/llama-3.1-70b-instruct",
  "mistralai/mixtral-8x7b-instruct-v0.1",
];

export function CommandPalette({
  onClose,
  onChangeModel,
  onClearHistory,
  sessionUsage,
}: {
  onClose: () => void;
  onChangeModel: (model: string) => void;
  onClearHistory: () => void;
  sessionUsage?: LanguageModelUsage;
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<"commands" | "models">("commands");

  const items = useMemo(() => {
    if (mode === "models") {
      return MODELS.filter((model) => model.toLowerCase().includes(query.toLowerCase())).map((model) => ({
        id: model,
        label: model,
        description: "Available model",
      }));
    }

    return COMMANDS.filter((command) => {
      const haystack = `${command.label} ${command.description}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }, [mode, query]);

  useInput((input, key) => {
    if (key.ctrl && input === "k") {
      onClose();
      return;
    }

    if (key.escape) {
      if (mode === "models") {
        setMode("commands");
        setQuery("");
        setSelectedIndex(0);
        return;
      }
      onClose();
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(Math.max(0, items.length - 1), prev + 1));
      return;
    }
    if (key.backspace || key.delete) {
      setQuery((prev) => prev.slice(0, -1));
      setSelectedIndex(0);
      return;
    }
    if (key.return) {
      const selected = items[selectedIndex];
      if (!selected) return;

      if (mode === "models") {
        onChangeModel(selected.id);
        onClose();
        return;
      }

      if (selected.id === "change-model") {
        setMode("models");
        setQuery("");
        setSelectedIndex(0);
        return;
      }
      if (selected.id === "clear-history") {
        onClearHistory();
        onClose();
        return;
      }
      if (selected.id === "view-usage") {
        setQuery(`usage ${sessionUsage?.totalTokens ?? 0} tokens`);
      }
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setQuery((prev) => prev + input);
      setSelectedIndex(0);
    }
  });

  return (
    <Box padding={1} backgroundColor={theme.bg} borderColor={theme.comment} flexDirection="column" width={80}>
      <Box paddingX={1}>
        <Text color={theme.fg} bold>
          Commands
        </Text>
      </Box>
      <Box paddingX={1}>
        <Text color={theme.comment}>/ </Text>
        <Text color={theme.fg}>{query}</Text>
        <Text backgroundColor={theme.purple} color={theme.bgDark}>
          {" "}
        </Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {items.map((item, index) => (
          <Box key={item.id} paddingX={1} backgroundColor={index === selectedIndex ? theme.selection : undefined}>
            <Text color={index === selectedIndex ? theme.fg : theme.comment}>
              {index === selectedIndex ? "▸ " : "  "}
            </Text>
            <Text color={theme.fg}>{item.label}</Text>
            <Text color={theme.comment}>  {item.description}</Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1} paddingX={1}>
          <Text color={theme.comment}>[↑↓] navigate  [enter] select  [ctrl+k/esc] close</Text>
      </Box>
    </Box>
  );
}
