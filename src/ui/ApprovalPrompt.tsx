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

  return (
    <Box borderStyle="round" borderColor={theme.yellow} flexDirection="column" width={80} paddingY={1}>
      <Box paddingX={1}>
        <Text color={theme.yellow}>⚠ Tool approval needed</Text>
      </Box>
      <Box paddingX={1} marginTop={1}>
        <Text color={theme.fg} bold>
          {toolName}
        </Text>
      </Box>
      <Box paddingX={1} marginTop={1}>
        <Text color={theme.comment}>{JSON.stringify(args, null, 2)}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1} paddingX={1}>
        <Text color={selectedOption === 0 ? theme.green : theme.comment} bold={selectedOption === 0}>
          {selectedOption === 0 ? "> YES" : "  YES"}
        </Text>
        <Text color={selectedOption === 1 ? theme.red : theme.comment} bold={selectedOption === 1}>
          {selectedOption === 1 ? "> NO" : "  NO"}
        </Text>
      </Box>
      <Box marginTop={1} paddingX={1}>
        <Text color={theme.comment}>[↑↓] select  [enter] confirm  [esc] deny</Text>
      </Box>
    </Box>
  );
}
