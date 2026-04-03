import { t, bold, fg } from "@opentui/core";
import { theme, colors, getToolStatusColor } from "../theme";
import type { ToolCall } from "../types";

interface ToolCallViewProps {
  toolCall: ToolCall;
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

function prettyPrintJSON(obj: any, maxLength: number = 300): string {
  const formatted = JSON.stringify(obj, null, 2);
  if (formatted.length <= maxLength) return formatted;
  return formatted.slice(0, maxLength) + "\n... (truncated)";
}

export function ToolCallView({ toolCall }: ToolCallViewProps) {
  const statusColor = getToolStatusColor(toolCall.status);
  const argsDisplay = prettyPrintJSON(toolCall.args, 200);
  const resultDisplay = toolCall.result
    ? prettyPrintJSON(
        typeof toolCall.result === "string" ? toolCall.result : toolCall.result,
        400
      )
    : null;

  return (
    <box
      width="100%"
      marginTop={1}
      paddingX={1}
      paddingY={1}
      backgroundColor={colors.bg}
      border={["left"]}
      borderStyle="single"
      borderColor={colors.yellow}
    >
      {/* Header */}
      <box width="100%" flexDirection="row" gap={1}>
        <text content={t`${fg(theme.yellow)("🔧 ")}${bold(fg(theme.yellow)(toolCall.name))}`} />
        <text content={t` ${fg(statusColor)(`${getStatusIcon(toolCall.status)} ${toolCall.status}`)}`} />
      </box>

      {/* Args */}
      <box width="100%" flexDirection="column" marginTop={1}>
        <text content={t`${fg(theme.comment)("Args:")}`} />
        <text content={argsDisplay} />
      </box>

      {/* Running indicator */}
      {toolCall.status === "running" && (
        <box width="100%" marginTop={1}>
          <text content={t`${bold(fg(theme.yellow)("⚡ Running..."))}`} />
        </box>
      )}

      {/* Result (if completed) */}
      {toolCall.status === "completed" && resultDisplay && (
        <box width="100%" flexDirection="column" marginTop={1}>
          <text content={t`${fg(theme.comment)("Result:")}`} />
          <text content={resultDisplay} />
        </box>
      )}

      {/* Error (if error) */}
      {toolCall.status === "error" && toolCall.result && (
        <box width="100%" flexDirection="column" marginTop={1}>
          <text content={t`${fg(theme.red)(`Error: ${resultDisplay}`)}`} />
        </box>
      )}

      {/* Denied message */}
      {toolCall.status === "denied" && (
        <box width="100%" marginTop={1}>
          <text content={t`${fg(theme.red)("Tool call was denied by user")}`} />
        </box>
      )}
    </box>
  );
}
