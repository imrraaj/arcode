import { useState, useMemo } from "react";
import { useKeyboard } from "@opentui/react";
import { theme, colors } from "../theme";
import type { LanguageModelUsage } from "ai";
import { AVAILABLE_MODELS } from "../types";

interface CommandPaletteProps {
  sessionUsage?: LanguageModelUsage;
  onClose: () => void;
  onChangeModel: (model: string) => void;
  onClearHistory: () => void;
  onClearSaved: () => void;
  onShowWelcome: () => void;
}

type Mode = "commands" | "models";

interface Command {
  id: string;
  label: string;
  description: string;
}

const COMMANDS: Command[] = [
  { id: "change-model", label: "Change Model", description: "Switch to a different AI model" },
  { id: "view-usage", label: "View Usage", description: "Show token usage statistics" },
  { id: "clear-history", label: "Clear History", description: "Reset conversation messages" },
  { id: "clear-saved", label: "Clear Saved Session", description: "Delete persisted session data" },
  { id: "show-welcome", label: "Show Welcome", description: "Show welcome screen with new session" },
];

export function CommandPalette({
  sessionUsage,
  onClose,
  onChangeModel,
  onClearHistory,
  onClearSaved,
  onShowWelcome,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("commands");

  const items = useMemo(() => {
    if (mode === "models") {
      return AVAILABLE_MODELS.filter((model) =>
        model.toLowerCase().includes(query.toLowerCase())
      ).map((model) => ({
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

  // Keyboard handling
  useKeyboard((key) => {
    if (key.ctrl && key.name === "k") {
      onClose();
      return;
    }

    if (key.name === "escape") {
      if (mode === "models") {
        setMode("commands");
        setQuery("");
        setSelectedIndex(0);
        return;
      }
      onClose();
      return;
    }

    if (key.name === "up") {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.name === "down") {
      setSelectedIndex((prev) => Math.min(Math.max(0, items.length - 1), prev + 1));
      return;
    }

    if (key.name === "backspace") {
      setQuery((prev) => prev.slice(0, -1));
      setSelectedIndex(0);
      return;
    }

    if (key.name === "return") {
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

      if (selected.id === "clear-saved") {
        onClearSaved();
        onClose();
        return;
      }

      if (selected.id === "show-welcome") {
        onShowWelcome();
        onClose();
        return;
      }

      if (selected.id === "view-usage") {
        setQuery(`usage ${sessionUsage?.totalTokens ?? 0} tokens`);
      }
      return;
    }

    // Character input
    if (key.sequence && key.sequence.length === 1) {
      setQuery((prev) => prev + key.sequence);
      setSelectedIndex(0);
    }
  });

  return (
    <box
      width={80}
      padding={1}
      backgroundColor={colors.bg}
      borderStyle="single"
      borderColor={theme.comment}
      flexDirection="column"
    >
      {/* Title */}
      <box width="100%" paddingX={1}>
        <text><strong>{mode === "models" ? "Select Model" : "Commands"}</strong></text>
      </box>

      {/* Search */}
      <box width="100%" paddingX={1} flexDirection="row">
        <text fg={theme.comment}>/ </text>
        <text>{query}</text>
        <text fg={theme.purple}>_</text>
      </box>

      {/* Items */}
      <box width="100%" flexDirection="column" marginTop={1}>
        {items.map((item, index) => (
          <box
            key={item.id}
            width="100%"
            paddingX={1}
            backgroundColor={index === selectedIndex ? theme.selection : undefined}
            flexDirection="row"
          >
            <text fg={index === selectedIndex ? theme.fg : theme.comment}>
              {index === selectedIndex ? "▸ " : "  "}
            </text>
            <text fg={theme.fg}>{item.label}</text>
            <text fg={theme.comment}> {item.description}</text>
          </box>
        ))}
      </box>

      {/* Footer */}
      <box width="100%" marginTop={1} paddingX={1}>
        <text fg={theme.comment}>
          [↑↓] navigate [enter] select [ctrl+k/esc] close
        </text>
      </box>
    </box>
  );
}
