import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "../theme";

export function ApprovalPrompt({
  toolName,
  args,
  onRespond,
  isActive,
}: {
  toolName: string;
  args: Record<string, any>;
  onRespond: (approved: boolean) => void;
  isActive: boolean;
}) {
  const [selectedOption, setSelectedOption] = useState<0 | 1>(0);

  useInput(
    (_, key) => {
      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) {
        setSelectedOption((prev) => (prev === 0 ? 1 : 0));
        return;
      }
      if (key.return) {
        onRespond(selectedOption === 0);
        return;
      }
      if (key.escape) {
        onRespond(false);
      }
    },
    { isActive }
  );

  const argsDisplay = JSON.stringify(args, null, 2);
  const truncatedArgs = argsDisplay.length > 200 
    ? argsDisplay.slice(0, 200) + "..." 
    : argsDisplay;

  return (
    <Box
      padding={1}
      backgroundColor={theme.bg}
      borderColor={theme.yellow}
      flexDirection="column"
      width={80}
    >
      <Box paddingX={1}>
        <Text color={theme.yellow} bold>⚠ Tool approval needed</Text>
      </Box>
      <Box paddingX={1} marginTop={1}>
        <Text color={theme.fg} bold>
          {toolName}
        </Text>
      </Box>
      <Box paddingX={1} marginTop={1}>
        <Text color={theme.comment}>{truncatedArgs}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1} paddingX={1}>
        <Box backgroundColor={selectedOption === 0 ? theme.selection : undefined}>
          <Text color={selectedOption === 0 ? theme.green : theme.comment} bold={selectedOption === 0}>
            {selectedOption === 0 ? "▸ " : "  "}
            YES - Approve this tool call
          </Text>
        </Box>
        <Box backgroundColor={selectedOption === 1 ? theme.selection : undefined}>
          <Text color={selectedOption === 1 ? theme.red : theme.comment} bold={selectedOption === 1}>
            {selectedOption === 1 ? "▸ " : "  "}
            NO - Deny this tool call
          </Text>
        </Box>
      </Box>
      <Box marginTop={1} paddingX={1}>
        <Text color={theme.comment}>[↑↓] select [enter] confirm [esc] deny</Text>
      </Box>
    </Box>
  );
}
