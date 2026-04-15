import { theme } from "../theme";

const LOGO = `
 ██████╗  ██████╗   ██████╗
 ██╔══██╗ ██╔══██╗ ██╔════╝
 ███████║ ██████╔╝ ██║
 ██╔══██║ ██╔══██╗ ██║
 ██║  ██║ ██║  ██║ ╚██████╗
 ╚═╝  ╚═╝ ╚═╝  ╚═╝  ╚═════╝`;

export function WelcomeScreen() {
  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
    >
      <text fg={theme.purple}>{LOGO}</text>
      <box height={2} />
      <text fg={theme.comment}>AI-powered terminal assistant</text>
      <box height={1} />
      <text fg={theme.comment}>[ctrl+k] commands | [esc] quit</text>
    </box>
  );
}
