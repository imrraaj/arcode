import { Box, Text } from "ink";
import { theme } from "../theme";

export interface ToolCall {
  id: string;
  assistantMessageIndex: number;
  name: string;
  args: Record<string, any>;
  result?: any;
  status: "pending" | "approved" | "denied" | "running" | "completed" | "error";
  timestamp: Date;
}

function getStatusIcon(status: ToolCall["status"]): string {
  switch (status) {
    case "approved":
      return "✓";
    case "denied":
      return "✗";
    case "running":
      return "⚡";
    case "completed":
      return "✓";
    case "error":
      return "!";
    default:
      return "○";
  }
}

function getStatusColor(status: ToolCall["status"]): string {
  switch (status) {
    case "approved":
    case "completed":
      return theme.green;
    case "denied":
      return theme.red;
    case "running":
      return theme.yellow;
    case "error":
      return theme.red;
    default:
      return theme.comment;
  }
}

function prettyPrintJSON(obj: any, maxLength: number = 300): string {
  const formatted = JSON.stringify(obj, null, 2);
  if (formatted.length <= maxLength) return formatted;
  return formatted.slice(0, maxLength) + "\n... (truncated)";
}

export function ToolCallView({ toolCall }: { toolCall: ToolCall }) {
  const argsDisplay = prettyPrintJSON(toolCall.args, 200);
  const resultDisplay = toolCall.result
    ? prettyPrintJSON(
        typeof toolCall.result === "string"
          ? toolCall.result
          : toolCall.result,
        400
      )
    : null;

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Header */}
      <Box>
        <Text color={theme.yellow}>🔧 </Text>
        <Text color={theme.yellow} bold>{toolCall.name}</Text>
        <Text color={theme.comment}> </Text>
        <Text color={getStatusColor(toolCall.status)} bold>
          {getStatusIcon(toolCall.status)} {toolCall.status}
        </Text>
      </Box>

      {/* Args */}
      <Box flexDirection="column">
        <Text color={theme.comment}>Args:</Text>
        <Text color={theme.fg}>{argsDisplay}</Text>
      </Box>

      {/* Running indicator */}
      {toolCall.status === "running" && (
        <Box>
          <Text color={theme.yellow} bold>⚡ Running...</Text>
        </Box>
      )}

      {/* Result (if completed) */}
      {toolCall.status === "completed" && resultDisplay && (
        <Box flexDirection="column">
          <Text color={theme.comment}>Result:</Text>
          <Text color={theme.fg}>{resultDisplay}</Text>
        </Box>
      )}

      {/* Error (if error) */}
      {toolCall.status === "error" && toolCall.result && (
        <Box flexDirection="column">
          <Text color={theme.red}>Error: {resultDisplay}</Text>
        </Box>
      )}

      {/* Denied message */}
      {toolCall.status === "denied" && (
        <Box>
          <Text color={theme.red}>Tool call was denied by user</Text>
        </Box>
      )}
    </Box>
  );
}
