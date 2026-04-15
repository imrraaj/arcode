import { useEffect, useState } from "react";
import { theme } from "../theme";

const SPINNER_FRAMES = ["✶", "✸", "✹", "✺", "✹", "✷"];

export function Indicator() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((prev) => prev + 1), 150);
    return () => clearInterval(id);
  }, []);

  const spinner = SPINNER_FRAMES[tick % SPINNER_FRAMES.length];

  return (
    <box flexDirection="row" gap={1}>
      <text>
        <strong fg={theme.comment}>{spinner}</strong>
      </text>
      <text fg={theme.comment}>arcing</text>
    </box>
  );

}
