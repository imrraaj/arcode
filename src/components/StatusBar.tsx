import { theme, colors } from "../theme";
import { config } from "@/utils/config";

interface StatusBarProps {
  model: string;
  msgCount: number;
  cumulativeTokens: {
    input: number;
    output: number;
    total: number;
  };
}

export function StatusBar({ model, msgCount, cumulativeTokens }: StatusBarProps) {
  const totalTokens = cumulativeTokens.total;
  const ctxPct = Math.min(100, Math.round((totalTokens / config.ui.modelContextWindow) * 100));

  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      justifyContent="space-between"
      backgroundColor={colors.bg}
    >
      <box width="100%" flexDirection="column" gap={2}>
        <text>
          <strong fg={theme.blue}>{config.appName}</strong>
          <span fg={theme.comment}> v{config.version}</span>
        </text>

        <box width="100%" flexDirection="column" gap={0}>
          <text><strong>Context</strong></text>
          <text fg={theme.comment}>{totalTokens} tokens</text>
          <text fg={theme.green}>{ctxPct}% used</text>
          <text fg={theme.comment}>{msgCount} messages</text>
        </box>
      </box>

      <box width="100%" flexDirection="column" gap={0}>
        <text fg={theme.comment}>[ctrl+k] commands</text>
        <text fg={theme.red}>[esc] quit</text>
      </box>
    </box>
  );
}
