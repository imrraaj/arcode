import { t, bold, fg } from "@opentui/core";
import { markdownStyle, theme, messageColors, colors } from "../theme";
import type { Message } from "../types";

interface MessageViewProps {
  msg: Message;
  width?: number;
  isStreaming?: boolean;
}

export function MessageView({ msg, width = 80, isStreaming = false }: MessageViewProps) {
  const roleColors = messageColors[msg.role];

  // User messages - plain text with styling
  if (msg.role === "user") {
    return (
      <box
        width="100%"
        paddingX={1}
        paddingY={1}
        backgroundColor={roleColors.bg}
        border={["left"]}
        borderStyle="heavy"
        borderColor={roleColors.border}
      >
        <text content={t`${bold(fg(theme.purple)(msg.content))}`} />
      </box>
    );
  }

  // Assistant messages - markdown with syntax highlighting
  // System messages - styled as info
  const borderColor = msg.role === "system" ? theme.yellow : theme.blue;

  return (
    <box
      width="100%"
      paddingX={1}
      paddingY={1}
      backgroundColor={roleColors.bg}
      border={["left"]}
      borderStyle="heavy"
      borderColor={borderColor}
    >
      <markdown
        content={msg.content}
        syntaxStyle={markdownStyle}
        width={width - 4}
        conceal={true}
        concealCode={false}
        streaming={isStreaming}
        fg={colors.fg}
        bg={roleColors.bg}
      />
    </box>
  );
}
