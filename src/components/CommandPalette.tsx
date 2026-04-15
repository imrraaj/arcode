import { useState, useMemo } from "react";
import { useKeyboard } from "@opentui/react";
import { theme, colors } from "../theme";
import { config } from "@/utils/config";
import type { SessionMeta } from "@/storage/session-store";

interface CommandPaletteProps {
  totalTokens: number;
  sessions: SessionMeta[];
  currentSessionId: string | null;
  onClose: () => void;
  onNewSession: () => void | Promise<void>;
  onSwitchSession: (sessionId: string) => void | Promise<void>;
  onChangeModel: (model: string) => void;
  onClearHistory: () => void | Promise<void>;
  onShowWelcome: () => void | Promise<void>;
}

type Mode = "commands" | "models" | "sessions";

interface Command {
  id: string;
  label: string;
  description: string;
}

const COMMANDS: Command[] = [
  { id: "change-model", label: "Change Model", description: "Switch to a different AI model" },
  { id: "new-session", label: "New Session", description: "Create a fresh session thread" },
  { id: "switch-session", label: "Switch Session", description: "Select an existing session thread" },
  { id: "view-usage", label: "View Usage", description: "Show token usage statistics" },
  { id: "clear-history", label: "Clear History", description: "Reset conversation messages" },
  { id: "show-welcome", label: "Show Welcome", description: "Show welcome screen with new session" },
];

export function CommandPalette({
  totalTokens,
  sessions,
  currentSessionId,
  onClose,
  onNewSession,
  onSwitchSession,
  onChangeModel,
  onClearHistory,
  onShowWelcome,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("commands");

  const setModeAndReset = (nextMode: Mode) => {
    setMode(nextMode);
    setQuery("");
    setSelectedIndex(0);
  };

  const items = useMemo(() => {
    const needle = query.toLowerCase();

    if (mode === "models") {
      return config.availableModels.filter((model) =>
        model.toLowerCase().includes(needle)
      ).map((model) => ({
        id: model,
        label: model,
        description: "Available model",
      }));
    }

    if (mode === "sessions") {
      return sessions
        .filter((session) => {
          const haystack = `${session.title} ${session.id}`.toLowerCase();
          return haystack.includes(needle);
        })
        .map((session) => ({
          id: session.id,
          label:
            session.id === currentSessionId
              ? `* ${session.title}`
              : session.title,
          description: `${session.messageCount} msgs • ${new Date(session.timestamp).toLocaleString()}`,
        }));
    }

    return COMMANDS.filter((command) => {
      const haystack = `${command.label} ${command.description}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [mode, query, sessions, currentSessionId]);

  useKeyboard((key) => {
    if (key.ctrl && key.name === "k") {
      onClose();
      return;
    }

    if (key.name === "escape") {
      if (mode === "models" || mode === "sessions") {
        setModeAndReset("commands");
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

      if (mode === "sessions") {
        void onSwitchSession(selected.id);
        onClose();
        return;
      }

      if (selected.id === "change-model") {
        setModeAndReset("models");
        return;
      }

      if (selected.id === "new-session") {
        void onNewSession();
        onClose();
        return;
      }

      if (selected.id === "switch-session") {
        setModeAndReset("sessions");
        return;
      }

      if (selected.id === "clear-history") {
        void onClearHistory();
        onClose();
        return;
      }

      if (selected.id === "show-welcome") {
        void onShowWelcome();
        onClose();
        return;
      }

      if (selected.id === "view-usage") {
        setQuery(`usage ${totalTokens} tokens`);
      }
      return;
    }

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
      <box width="100%" paddingX={1}>
        <text>
          <strong>
            {{ models: "Select Model", sessions: "Select Session", commands: "Commands" }[mode]}
          </strong>
        </text>
      </box>

      <box width="100%" paddingX={1} flexDirection="row">
        <text fg={theme.comment}>/ </text>
        <text>{query}</text>
        <text fg={theme.purple}>_</text>
      </box>

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

      <box width="100%" marginTop={1} paddingX={1}>
        <text fg={theme.comment}>
          [↑↓] navigate [enter] select [ctrl+k/esc] close
        </text>
      </box>
    </box>
  );
}
