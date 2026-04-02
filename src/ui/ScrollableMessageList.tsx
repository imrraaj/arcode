import { useMemo } from "react";
import { Box } from "ink";
import { Message, MessageView, renderMarkdown } from "./MessageView";
import { ToolCallView, type ToolCall } from "./ToolCallView";

export interface ScrollableMessageListProps {
  messages: Message[];
  toolCalls: ToolCall[];
  scrollOffset: number;
  maxHeight: number;
  width: number;
  streamingMessage?: Message;
}

/**
 * Estimate the height of a message in terminal rows.
 */
function estimateMessageHeight(msg: Message, width: number): number {
  const rendered = msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content;
  const lineCount = rendered.split("\n").length;
  const estimatedWrappedLines = Math.ceil(rendered.length / Math.max(1, width - 4));
  const actualLines = Math.max(lineCount, estimatedWrappedLines);
  return 1 + 2 + actualLines;
}

function estimateToolCallHeight(toolCall: ToolCall): number {
  if (toolCall.status === "completed" && toolCall.result) {
    return 8;
  }
  return 5;
}

function calculateVisibleRange(
  messages: Message[],
  toolCalls: ToolCall[],
  scrollOffset: number,
  maxHeight: number,
  width: number
): { startIndex: number; endIndex: number; hasMoreAbove: boolean; hasMoreBelow: boolean } {
  if (messages.length === 0) {
    return { startIndex: 0, endIndex: 0, hasMoreAbove: false, hasMoreBelow: false };
  }

  const totalMessages = messages.length;
  const messageHeights = messages.map((msg) => estimateMessageHeight(msg, width));
  let totalHeight = messageHeights.reduce((sum, h) => sum + h, 0);
  totalHeight += toolCalls.reduce((sum, tc) => sum + estimateToolCallHeight(tc), 0);

  if (totalHeight <= maxHeight && scrollOffset === 0) {
    return {
      startIndex: 0,
      endIndex: totalMessages,
      hasMoreAbove: false,
      hasMoreBelow: false,
    };
  }

  const toolCallsHeight = toolCalls.reduce((sum, tc) => sum + estimateToolCallHeight(tc), 0);
  const availableHeight = maxHeight - toolCallsHeight;
  
  let viewportCapacity = 0;
  let accumulatedHeight = 0;
  for (let i = totalMessages - 1; i >= 0; i--) {
    if (accumulatedHeight + messageHeights[i] > availableHeight) break;
    accumulatedHeight += messageHeights[i];
    viewportCapacity++;
  }

  let endIndex = totalMessages;
  let startIndex = Math.max(0, totalMessages - viewportCapacity);

  if (scrollOffset > 0) {
    endIndex = Math.max(viewportCapacity, totalMessages - scrollOffset);
    startIndex = Math.max(0, endIndex - viewportCapacity);
  }

  startIndex = Math.max(0, startIndex);
  endIndex = Math.min(totalMessages, endIndex);

  const hasMoreAbove = startIndex > 0;
  const hasMoreBelow = endIndex < totalMessages;

  return { startIndex, endIndex, hasMoreAbove, hasMoreBelow };
}

export function ScrollableMessageList({
  messages,
  toolCalls,
  scrollOffset,
  maxHeight,
  width,
  streamingMessage,
}: ScrollableMessageListProps) {
  const { startIndex, endIndex } = useMemo(() => {
    return calculateVisibleRange(messages, toolCalls, scrollOffset, maxHeight, width);
  }, [messages, toolCalls, scrollOffset, maxHeight, width]);

  const visibleMessages = useMemo(() => {
    return messages.slice(startIndex, endIndex);
  }, [messages, startIndex, endIndex]);

  // Group tool calls by the message index they follow
  const toolCallsByMessageIndex = useMemo(() => {
    const map = new Map<number, ToolCall[]>();
    toolCalls.forEach((tc) => {
      const idx = tc.assistantMessageIndex;
      if (!map.has(idx)) map.set(idx, []);
      map.get(idx)!.push(tc);
    });
    return map;
  }, [toolCalls]);

  // Tool calls without a message index (currently running)
  const orphanToolCalls = useMemo(() => {
    return toolCalls.filter(tc => tc.assistantMessageIndex === -1);
  }, [toolCalls]);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={maxHeight}
      overflow="hidden"
    >
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        <Box flexDirection="column" flexShrink={0}>
          {/* Render orphan tool calls (not yet associated with a message) */}
          {orphanToolCalls.map((tc) => (
            <ToolCallView key={tc.id} toolCall={tc} />
          ))}

          {visibleMessages.map((msg, i) => (
            <Box key={`${startIndex + i}-${msg.role}`} flexDirection="column">
              <MessageView msg={msg} />
              {/* Render tool calls associated with this assistant message */}
              {msg.role === "assistant" && toolCallsByMessageIndex.get(startIndex + i)?.map((tc) => (
                <ToolCallView key={tc.id} toolCall={tc} />
              ))}
            </Box>
          ))}

          {streamingMessage && (
            <MessageView msg={streamingMessage} />
          )}
        </Box>
      </Box>
    </Box>
  );
}
