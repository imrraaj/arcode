import { useEffect, useState } from "react";
import { LanguageModelUsage } from "ai";
import { Box, Text, useStdout } from "ink";
import { theme } from "../theme";

const MODEL_CONTEXT_WINDOW = 32768;

function ctxColor(pct: number) {
  if (pct >= 80) return theme.red;
  if (pct >= 60) return theme.yellow;
  return theme.green;
}

export function StatusBar({
  model,
  msgCount,
  sessionUsage,
}: {
  model: string;
  msgCount: number;
  sessionUsage?: LanguageModelUsage;
}) {
  const completionTokens = sessionUsage?.outputTokens ?? 0;
  const totalTokens = sessionUsage?.totalTokens ?? 0;
  const ctxPct = Math.round((totalTokens / MODEL_CONTEXT_WINDOW) * 100);

  return (
    <Box flexDirection="column" justifyContent="space-between" gap={1} backgroundColor={theme.bg} height={"100%"}>
      <Box flexDirection="column">
        <Box>
          <Text color={theme.blue} bold>arc</Text>
          <Text color={theme.comment} bold> v0.1.0</Text>
        </Box>

        <Box gap={0} marginY={2} flexDirection="column">
          <Text bold>Context</Text>
          <Text color={theme.comment}>{completionTokens} tokens</Text>
          <Text color={ctxColor(ctxPct)}>{ctxPct}% used</Text>
        </Box>
      </Box>

      <Box gap={0} flexDirection="column">
        <Text color={theme.comment}>[ctrl+k] commands</Text>
        <Text color={theme.red}>[esc] quit</Text>
      </Box>
    </Box>
  );
}
