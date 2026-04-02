import { render } from "ink";
import { App } from "./app";
import process from "process";

console.clear();

// Handle cleanup on exit
const cleanup = () => {
  // Restore terminal to normal state
  process.stdout.write("\x1b[?1049l"); // Exit alternate screen
  process.stdout.write("\x1b[?1000l"); // Disable mouse tracking
  process.stdout.write("\x1b[?1006l"); // Disable SGR mouse
  process.stdout.write("\x1b[?1002l"); // Disable button tracking
  process.stdout.write("\x1b[?25h");   // Show cursor
  process.stdout.write("\x1b[0m");     // Reset all attributes
  process.stdout.write("\x1b[?7h");    // Enable line wrapping
};

// Register cleanup for normal exit
process.on("exit", cleanup);

// Register cleanup for signals
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

render(<App />, { maxFps: 30 });
