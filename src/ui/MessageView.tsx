import { Box, Text } from "ink";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { useMemo } from "react";
import { theme } from "../theme";

// Configure once at module level — never call marked.use() again
marked.use(markedTerminal({ reflowText: true, width: process.stdout.columns || 120 }) as any);

function normalizeMarkdown(content: string): string {
  return content
    .split("\n")
    .map((line) => line.replace(/^\s{4,}((?:[-*+]\s|\d+\.\s))/, "$1"))
    .join("\n");
}

export function renderMarkdown(content: string): string {
  try {
    return String(marked.parse(normalizeMarkdown(content))).trimEnd();
  } catch {
    return content;
  }
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export function MessageView({ msg }: { msg: Message }) {
  const renderedContent = useMemo(
    () => (msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content),
    [msg.content, msg.role]
  );

  if (msg.role === "user") {
    return (
      <Box marginTop={1} flexDirection="column">
        <Box
          backgroundColor={theme.bg}
          borderStyle="single"
          borderLeft
          borderTop={false}
          borderRight={false}
          borderBottom={false}
          borderColor={theme.purple}
          paddingLeft={1}
          paddingRight={2}
          paddingY={1}
          flexDirection="column"
        >
          <Text color={theme.fg} bold>{renderedContent}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box
        backgroundColor={theme.bg}
        borderColor={theme.blue}
        paddingLeft={1}
        paddingRight={2}
        paddingY={1}
        flexDirection="column"
      >
        <Text>{renderedContent}</Text>
      </Box>
    </Box>
  );
}
