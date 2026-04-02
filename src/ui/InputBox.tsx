import { useCallback, useEffect, useRef } from "react";
import { Box, Text, useInput, useStdin } from "ink";
import { theme } from "../theme";

function isMouseWheelSequence(input: string): boolean {
  return /^\x1b\[<\d+;\d+;\d+[Mm]$/.test(input);
}

function previousWordBoundary(value: string, cursor: number) {
  let index = cursor;
  while (index > 0 && value[index - 1] === " ") index -= 1;
  while (index > 0 && value[index - 1] !== " ") index -= 1;
  return index;
}

function nextWordBoundary(value: string, cursor: number) {
  let index = cursor;
  while (index < value.length && value[index] !== " ") index += 1;
  while (index < value.length && value[index] === " ") index += 1;
  return index;
}

function isBackspaceSequence(data: string) {
  return (
    data === "\u007f" ||
    data === "\b" ||
    data === "\u001b\u007f" ||
    /^\u001b\[(8|127)(;\d+)?u$/.test(data)
  );
}

export function InputBox({
  value,
  cursor,
  onChange,
  onSubmit,
  onCommandPalette,
  placeholder,
  isActive,
}: {
  value: string;
  cursor: number;
  onChange: (value: string, cursor: number) => void;
  onSubmit: (value: string) => void;
  onCommandPalette: () => void;
  placeholder?: string;
  isActive: boolean;
}) {
  const { stdin } = useStdin();
  const lastBackspaceHandledAt = useRef(0);

  const deleteBackward = useCallback(() => {
    if (cursor === 0) return;
    lastBackspaceHandledAt.current = Date.now();
    onChange(value.slice(0, cursor - 1) + value.slice(cursor), cursor - 1);
  }, [cursor, onChange, value]);

  const deleteForward = useCallback(() => {
    if (cursor >= value.length) return;
    onChange(value.slice(0, cursor) + value.slice(cursor + 1), cursor);
  }, [cursor, onChange, value]);

  useInput(
    (input, key) => {
      if (isMouseWheelSequence(input)) {
        return;
      }

      if (key.meta && input === "b") {
        onChange(value, previousWordBoundary(value, cursor));
        return;
      }
      if (key.meta && input === "f") {
        onChange(value, nextWordBoundary(value, cursor));
        return;
      }
      if (key.return) {
        onSubmit(value);
        return;
      }
      if ((key.ctrl && input === "a") || key.home) {
        onChange(value, 0);
        return;
      }
      if ((key.ctrl && input === "e") || key.end) {
        onChange(value, value.length);
        return;
      }
      if (key.ctrl && input === "k") {
        onCommandPalette();
        return;
      }
      if (key.ctrl && input === "u") {
        onChange("", 0);
        return;
      }
      if (key.ctrl && input === "w") {
        const boundary = previousWordBoundary(value, cursor);
        onChange(value.slice(0, boundary) + value.slice(cursor), boundary);
        return;
      }
      if (key.leftArrow) {
        onChange(value, Math.max(0, cursor - 1));
        return;
      }
      if (key.rightArrow) {
        onChange(value, Math.min(value.length, cursor + 1));
        return;
      }

      if ((key.ctrl && input === "d") || key.delete) {
        deleteForward();
        return;
      }

      const isBackspace =
        key.backspace ||
        input === "\u007f" ||
        input === "\b" ||
        (key.ctrl && input === "h");

      if (isBackspace) {
        deleteBackward();
        return;
      }
      if (input && !key.ctrl && !key.meta && !key.escape) {
        onChange(value.slice(0, cursor) + input + value.slice(cursor), cursor + input.length);
      }
    },
    { isActive }
  );

  useEffect(() => {
    if (!isActive) return;

    const handleData = (chunk: string | Buffer) => {
      const data = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      if (!isBackspaceSequence(data)) return;
      if (Date.now() - lastBackspaceHandledAt.current < 30) return;
      deleteBackward();
    };

    stdin.on("data", handleData);
    return () => {
      stdin.off("data", handleData);
    };
  }, [deleteBackward, isActive, stdin]);

  const beforeCursor = value.slice(0, cursor);
  const cursorChar = value[cursor] || " ";
  const afterCursor = value.slice(cursor + 1);

  return (
    <Box >
      <Text color={theme.purple} bold>
        ❯{" "}
      </Text>
      {value.length === 0 ? (
        <>
          <Text backgroundColor={theme.purple} color={theme.bgDark}>
            {" "}
          </Text>
          <Text color={theme.comment}>{placeholder ?? "Ask anything..."}</Text>
        </>
      ) : (
        <>
          <Text color={theme.fg}>{beforeCursor}</Text>
          <Text backgroundColor={theme.purple} color={theme.bgDark}>
            {cursorChar}
          </Text>
          <Text color={theme.fg}>{afterCursor}</Text>
        </>
      )}
    </Box>
  );
}
