import { useState } from "react";
import { useKeyboard } from "@opentui/react";
import { theme, colors } from "../theme";

interface ApprovalPromptProps {
  toolName: string;
  args: Record<string, any>;
  onRespond: (approved: boolean) => void;
}

export function ApprovalPrompt({ toolName, args, onRespond }: ApprovalPromptProps) {
  const [selectedOption, setSelectedOption] = useState<0 | 1>(0);

  useKeyboard((key) => {
    if (key.name === "up" || key.name === "down" || key.name === "left" || key.name === "right") {
      setSelectedOption((prev) => (prev === 0 ? 1 : 0));
      return;
    }
    if (key.name === "return") {
      onRespond(selectedOption === 0);
      return;
    }
    if (key.name === "escape") {
      onRespond(false);
    }
  });

  const argsDisplay = JSON.stringify(args, null, 2);
  const truncatedArgs = argsDisplay.length > 200 ? argsDisplay.slice(0, 200) + "..." : argsDisplay;

  return (
    <box
      width={80}
      padding={1}
      backgroundColor={colors.bg}
      borderStyle="single"
      borderColor={theme.yellow}
      flexDirection="column"
    >
      <box width="100%" paddingX={1}>
        <text fg={theme.yellow}>
          <strong>⚠ Tool approval needed</strong>
        </text>
      </box>

      <box width="100%" paddingX={1} marginTop={1}>
        <text><strong>{toolName}</strong></text>
      </box>

      <box width="100%" paddingX={1} marginTop={1}>
        <text fg={theme.comment}>{truncatedArgs}</text>
      </box>

      <box width="100%" flexDirection="column" marginTop={1} paddingX={1}>
        <box
          width="100%"
          backgroundColor={selectedOption === 0 ? theme.selection : undefined}
        >
          <text fg={selectedOption === 0 ? theme.green : theme.comment}>
            <strong>{selectedOption === 0 ? "▸ " : "  "}</strong>
            YES - Approve this tool call
          </text>
        </box>
        <box
          width="100%"
          backgroundColor={selectedOption === 1 ? theme.selection : undefined}
        >
          <text fg={selectedOption === 1 ? theme.red : theme.comment}>
            <strong>{selectedOption === 1 ? "▸ " : "  "}</strong>
            NO - Deny this tool call
          </text>
        </box>
      </box>

      <box width="100%" marginTop={1} paddingX={1}>
        <text fg={theme.comment}>[↑↓] select [enter] confirm [esc] deny</text>
      </box>
    </box>
  );
}
