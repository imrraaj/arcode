import { useMemo } from "react";
import { Box } from "ink";
import { Message, MessageView, renderMarkdown } from "./MessageView";

export interface ScrollableMessageListProps {
  messages: Message[];
  scrollOffset: number;
  maxHeight: number;
  width: number;
  streamingMessage?: Message;
}

/**
 * Estimate the height of a message in terminal rows.
 * Each message has: 1 (marginTop) + 2 (paddingY) + content lines
 */
function estimateMessageHeight(msg: Message, width: number): number {
  const rendered = msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content;
  const lineCount = rendered.split("\n").length;
  // Account for text wrapping: estimate lines based on content length vs width
  const estimatedWrappedLines = Math.ceil(rendered.length / Math.max(1, width - 4)); // -4 for padding
  const actualLines = Math.max(lineCount, estimatedWrappedLines);
  return 1 + 2 + actualLines; // marginTop + paddingY + content
}

/**
 * Calculate the visible message range and scroll offset.
 *
 * Bottom-up scrolling:
 * - scrollOffset = 0: Show newest messages at bottom (show messages from end backward that fit)
 * - scrollOffset > 0: Hide N newest messages, show older ones above
 *
 * Example with 10 messages:
 * - scrollOffset = 0: Show messages that fit from the end (e.g., [5,6,7,8,9] if they fit)
 * - scrollOffset = 3: Hide 3 newest, show [2,3,4,5,6] (older messages)
 */
function calculateVisibleRange(
  messages: Message[],
  scrollOffset: number,
  maxHeight: number,
  width: number
): { startIndex: number; endIndex: number; hasMoreAbove: boolean; hasMoreBelow: boolean } {
  if (messages.length === 0) {
    return { startIndex: 0, endIndex: 0, hasMoreAbove: false, hasMoreBelow: false };
  }

  const totalMessages = messages.length;

  // Calculate total content height
  const messageHeights = messages.map((msg) => estimateMessageHeight(msg, width));
  const totalHeight = messageHeights.reduce((sum, h) => sum + h, 0);

  // If everything fits, show all
  if (totalHeight <= maxHeight && scrollOffset === 0) {
    return {
      startIndex: 0,
      endIndex: totalMessages,
      hasMoreAbove: false,
      hasMoreBelow: false,
    };
  }

  // Calculate how many messages fit in the viewport
  let viewportCapacity = 0;
  let accumulatedHeight = 0;
  for (let i = totalMessages - 1; i >= 0; i--) {
    if (accumulatedHeight + messageHeights[i] > maxHeight) break;
    accumulatedHeight += messageHeights[i];
    viewportCapacity++;
  }

  // Default: show newest messages that fit
  let endIndex = totalMessages;
  let startIndex = Math.max(0, totalMessages - viewportCapacity);

  // Apply scroll offset: move window toward older messages
  if (scrollOffset > 0) {
    // Move window back by scrollOffset messages
    endIndex = Math.max(viewportCapacity, totalMessages - scrollOffset);
    startIndex = Math.max(0, endIndex - viewportCapacity);
  }

  // Ensure bounds
  startIndex = Math.max(0, startIndex);
  endIndex = Math.min(totalMessages, endIndex);

  // Determine if there are more messages
  const hasMoreAbove = startIndex > 0; // Older messages exist
  const hasMoreBelow = endIndex < totalMessages; // Newer messages exist (we've scrolled up)

  return { startIndex, endIndex, hasMoreAbove, hasMoreBelow };
}

/**
 * A scrollable message list component that constrains content to maxHeight
 * and provides visual overflow indicators.
 *
 * Scroll behavior: Bottom-up (newest at bottom)
 * - scrollOffset 0: Shows newest messages at bottom
 * - scrollOffset N: Shows N older messages, hiding the N newest
 */
export function ScrollableMessageList({
  messages,
  scrollOffset,
  maxHeight,
  width,
  streamingMessage,
}: ScrollableMessageListProps) {
  // Calculate visible range
  const { startIndex, endIndex, hasMoreAbove, hasMoreBelow } = useMemo(() => {
    return calculateVisibleRange(messages, scrollOffset, maxHeight, width);
  }, [messages, scrollOffset, maxHeight, width]);

  // Messages to display
  const visibleMessages = useMemo(() => {
    return messages.slice(startIndex, endIndex);
  }, [messages, startIndex, endIndex]);

  // Hidden message counts
  const hiddenAbove = startIndex; // Older messages hidden above
  const hiddenBelow = messages.length - endIndex; // Newer messages hidden below

  return (
    <Box
      flexDirection="column"
      width={width}
      height={maxHeight}
      overflow="hidden"
    >
      {/* Scrollable content area */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        <Box flexDirection="column" flexShrink={0}>
          {visibleMessages.map((msg, i) => (
            <MessageView
              key={`${startIndex + i}-${msg.role}-${msg.content.slice(0, 16)}`}
              msg={msg}
            />
          ))}
          {streamingMessage && <MessageView msg={streamingMessage} />}
        </Box>
      </Box>
    </Box>
  );
}
