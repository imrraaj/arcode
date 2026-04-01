import { render } from "ink";
import { App } from "./app";

console.clear();
render(<App />, { maxFps: 30 });