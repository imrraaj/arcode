import { useState } from "react";
import { theme, colors } from "../theme";

interface ApiKeyPromptProps {
  onSubmit: (apiKey: string) => void;
  saving: boolean;
  error?: string | null;
}

export function ApiKeyPrompt({ onSubmit, saving, error }: ApiKeyPromptProps) {
  const [apiKey, setApiKey] = useState("");

  const submit = () => {
    const trimmed = apiKey.trim();
    if (!trimmed || saving) return;
    onSubmit(trimmed);
  };

  return (
    <box
      width={80}
      padding={1}
      backgroundColor={colors.bg}
      borderStyle="single"
      borderColor={theme.blue}
      flexDirection="column"
      gap={1}
    >
      <box width="100%" paddingX={1}>
        <text>
          <strong fg={theme.blue}>NVIDIA API Key Required</strong>
        </text>
      </box>

      <box width="100%" paddingX={1}>
        <text fg={theme.comment}>
          Enter your NVIDIA API key to start using Arc.
        </text>
      </box>

      <box width="100%" paddingX={1}>
        <text fg={theme.comment}>Stored at .arc/config.json</text>
      </box>

      <box width="100%" paddingX={1} flexDirection="row">
        <text fg={theme.purple}>Key: </text>
        <input
          value={apiKey}
          placeholder="nvapi-..."
          onInput={setApiKey}
          onSubmit={submit}
          focused={!saving}
          width="100%"
          backgroundColor={colors.bg}
          textColor={colors.fg}
          cursorColor={colors.purple}
        />
      </box>

      {error && (
        <box width="100%" paddingX={1}>
          <text fg={theme.red}>{error}</text>
        </box>
      )}

      <box width="100%" paddingX={1}>
        <text fg={saving ? theme.yellow : theme.comment}>
          {saving ? "Saving..." : "[enter] save key"}
        </text>
      </box>
    </box>
  );
}
