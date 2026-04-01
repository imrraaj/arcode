import { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { theme } from "../theme";

export function Spinner({ label }: { label: string }) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((prev) => (prev + 1) % frames.length), 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box>
      <Text color={theme.yellow}>{frames[index]} </Text>
      <Text color={theme.comment} italic>
        {label}
      </Text>
    </Box>
  );
}
