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
  const { stdout } = useStdout();
  const [cols, setCols] = useState(stdout.columns || 80);

  useEffect(() => {
    const handler = () => setCols(stdout.columns || 80);
    stdout.on("resize", handler);
    return () => {
      stdout.off("resize", handler);
    };
  }, [stdout]);

  const promptTokens = sessionUsage?.inputTokens ?? 0;
  const completionTokens = sessionUsage?.outputTokens ?? 0;
  const totalTokens = sessionUsage?.totalTokens ?? 0;
  const ctxPct = Math.round((totalTokens / MODEL_CONTEXT_WINDOW) * 100);
  const modelDisplay = model.includes("/") ? model.split("/")[1] : model;

  return (
    <Box justifyContent="space-between" backgroundColor={theme.bgDark}>
      <Box>
        <Text color={theme.blue} bold>
          arc
        </Text>
        <Text color={theme.comment}> v0.1.0 │ </Text>
        <Text color={theme.fg}>{modelDisplay}</Text>
      </Box>

      <Box>
        <Text color={theme.comment}>{promptTokens}↑ </Text>
        <Text color={theme.comment}>{completionTokens}↓ </Text>
        <Text color={theme.comment}>│ ctx: </Text>
        <Text color={ctxColor(ctxPct)}>{ctxPct}%</Text>
      </Box>

      <Box>
        <Text color={theme.cyan}>[ctrl+k]</Text>
        <Text color={theme.comment}> cmds  </Text>
        <Text color={theme.cyan}>[esc]</Text>
        <Text color={theme.comment}> quit</Text>
      </Box>
    </Box>
  );
}
