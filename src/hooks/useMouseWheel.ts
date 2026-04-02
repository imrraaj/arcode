import { useEffect, useRef } from "react";
import { useStdin } from "ink";

export interface MouseWheelHandler {
  onScrollUp?: () => void;
  onScrollDown?: () => void;
}

/**
 * Hook to handle mouse wheel scrolling in the terminal.
 * Uses SGR 1006 mouse mode for modern terminal emulators.
 */
export function useMouseWheel({ onScrollUp, onScrollDown }: MouseWheelHandler, isActive: boolean = true) {
  const { stdin, setRawMode } = useStdin();
  const handlersRef = useRef({ onScrollUp, onScrollDown });

  // Keep handlers fresh
  handlersRef.current = { onScrollUp, onScrollDown };

  useEffect(() => {
    if (!isActive || !stdin) return;

    // Enable mouse tracking (SGR 1006 mode for extended coordinates)
    // \x1b[?1000h - basic mouse tracking
    // \x1b[?1002h - button event tracking (includes wheel)
    // \x1b[?1006h - SGR extended coordinates
    const enableMouse = "\x1b[?1000h\x1b[?1002h\x1b[?1006h";
    const disableMouse = "\x1b[?1000l\x1b[?1002l\x1b[?1006l";

    // Write using stdout if available, otherwise stdin
    const output = (stdin as any).write ? stdin : process.stdout;
    (output as NodeJS.WriteStream).write?.(enableMouse);

    // Track if we set raw mode
    const wasRaw = (stdin as any).isRaw;
    setRawMode?.(true);

    let buffer = "";

    const handleData = (chunk: Buffer | string) => {
      const data = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
      buffer += data;

      // Process buffer for mouse sequences
      while (buffer.length > 0) {
        // SGR mouse mode: ESC[ < button ; x ; y M
        // Wheel up: button=64, Wheel down: button=65
        const sgrMatch = buffer.match(/^\x1b\[<(\d+);(\d+);(\d+)M/);
        if (sgrMatch) {
          const button = parseInt(sgrMatch[1], 10);

          if (button === 64) {
            handlersRef.current.onScrollUp?.();
          } else if (button === 65) {
            handlersRef.current.onScrollDown?.();
          }

          buffer = buffer.slice(sgrMatch[0].length);
          continue;
        }

        // Alternative format (older terminals): ESC[M followed by 3 bytes
        const oldMatch = buffer.match(/^\x1b\x1b\[M([\x00-\xff]{3})/);
        if (oldMatch) {
          // Old format: byte 1 encodes button+32, wheel = 64/65 -> wheel = button byte - 32
          const buttonByte = oldMatch[1].charCodeAt(0) - 32;
          // 64 = wheel up, 65 = wheel down (in old format, add 32)
          if (buttonByte === 64) {
            handlersRef.current.onScrollUp?.();
          } else if (buttonByte === 65) {
            handlersRef.current.onScrollDown?.();
          }
          buffer = buffer.slice(oldMatch[0].length);
          continue;
        }

        // X11 mouse tracking: ESC[M followed by encoded coordinates
        const x11Match = buffer.match(/^\x1b\[M([\x00-\xff])([\x00-\xff])([\x00-\xff])/);
        if (x11Match) {
          const button = x11Match[1].charCodeAt(0);
          // Button encoding: bit 6-7 encode button, bit 2 = wheel
          // Wheel up: button & 0x40, wheel down: button & 0x41
          const btnCode = button - 32; // Remove offset
          if (btnCode === 64) {
            handlersRef.current.onScrollUp?.();
          } else if (btnCode === 65) {
            handlersRef.current.onScrollDown?.();
          }
          buffer = buffer.slice(x11Match[0].length);
          continue;
        }

        // Skip regular ANSI escape sequences (cursor keys, etc)
        const ansiMatch = buffer.match(/^\x1b(?:\[([0-9;]*)([A-Za-z])|\[([<])([^M])|O([A-Z])|(\))[0-9A-Za-z])/);
        if (ansiMatch) {
          buffer = buffer.slice(ansiMatch[0].length);
          continue;
        }

        // If buffer starts with ESC but we have incomplete sequence, wait
        if (buffer.startsWith("\x1b") && buffer.length < 20) {
          break;
        }

        // Not an escape sequence, consume one character
        buffer = buffer.slice(1);
      }

      // Prevent buffer overflow
      if (buffer.length > 200) {
        buffer = buffer.slice(-100);
      }
    };

    stdin.on("data", handleData);

    return () => {
      (output as NodeJS.WriteStream).write?.(disableMouse);
      stdin.off("data", handleData);
      if (!wasRaw) {
        setRawMode?.(false);
      }
    };
  }, [isActive, stdin, setRawMode]);
}
