import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./app";

console.clear();

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  targetFps: 30,
  maxFps: 60,
  screenMode: "main-screen",
  useMouse: true,
  enableMouseMovement: true,
  autoFocus: true,
  backgroundColor: "#181818",
});

createRoot(renderer).render(<App />);
