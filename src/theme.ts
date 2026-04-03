import { SyntaxStyle, RGBA } from "@opentui/core";

// Color palette - keeping the existing theme
export const theme = {
  bg: "#1d1f21",
  bgDark: "#151718",
  fg: "#c5c8c6",
  comment: "#969896",
  red: "#cc6666",
  orange: "#de935f",
  yellow: "#f0c674",
  green: "#b5bd68",
  cyan: "#8abeb7",
  blue: "#81a2be",
  purple: "#b294bb",
  selection: "#373b41",
} as const;

export type Theme = typeof theme;

// RGBA helpers for OpenTUI
export const colors = {
  bg: RGBA.fromHex(theme.bg),
  bgDark: RGBA.fromHex(theme.bgDark),
  fg: RGBA.fromHex(theme.fg),
  comment: RGBA.fromHex(theme.comment),
  red: RGBA.fromHex(theme.red),
  orange: RGBA.fromHex(theme.orange),
  yellow: RGBA.fromHex(theme.yellow),
  green: RGBA.fromHex(theme.green),
  cyan: RGBA.fromHex(theme.cyan),
  blue: RGBA.fromHex(theme.blue),
  purple: RGBA.fromHex(theme.purple),
  selection: RGBA.fromHex(theme.selection),
};

// Markdown syntax styling for assistant messages
export const markdownStyle = SyntaxStyle.fromStyles({
  // Headings
  "markup.heading.1": { fg: colors.blue, bold: true },
  "markup.heading.2": { fg: colors.blue, bold: true },
  "markup.heading.3": { fg: colors.blue, bold: true },
  "markup.heading": { fg: colors.blue, bold: true },

  // Lists
  "markup.list": { fg: colors.purple },
  "markup.list.item": { fg: colors.fg },

  // Code
  "markup.raw": { fg: colors.green },
  "markup.raw.inline": { fg: colors.green },
  "markup.fenced_code": { fg: colors.green },

  // Emphasis
  "markup.bold": { bold: true },
  "markup.italic": { italic: true },
  "markup.strikethrough": { fg: colors.comment }, // strikethrough not supported, use muted color

  // Links
  "markup.link": { fg: colors.cyan, underline: true },
  "markup.link.url": { fg: colors.cyan, underline: true },
  "markup.link.label": { fg: colors.cyan },
  "markup.link.text": { fg: colors.cyan },

  // Quotes
  "markup.quote": { fg: colors.comment, italic: true },

  // Tables
  "markup.table": { fg: colors.fg },
  "markup.table.header": { fg: colors.blue, bold: true },
  "markup.table.row": { fg: colors.fg },

  // Code blocks (Tree-sitter injection)
  "keyword": { fg: colors.purple, bold: true },
  "string": { fg: colors.green },
  "number": { fg: colors.orange },
  "function": { fg: colors.blue },
  "variable": { fg: colors.red },
  "comment": { fg: colors.comment, italic: true },
  "type": { fg: colors.yellow },
  "operator": { fg: colors.cyan },
  "punctuation": { fg: colors.comment },

  // Default text
  default: { fg: colors.fg },
});

// Status colors based on context percentage
export function getContextColor(pct: number): RGBA {
  if (pct >= 80) return colors.red;
  if (pct >= 60) return colors.yellow;
  return colors.green;
}

// Tool call status colors
export function getToolStatusColor(status: string): RGBA {
  switch (status) {
    case "approved":
    case "completed":
      return colors.green;
    case "denied":
    case "error":
      return colors.red;
    case "running":
      return colors.yellow;
    default:
      return colors.comment;
  }
}

// Role-based message colors
export const messageColors = {
  user: {
    border: colors.purple,
    bg: colors.bg,
  },
  assistant: {
    border: colors.blue,
    bg: colors.bg,
  },
  system: {
    border: colors.yellow,
    bg: colors.bgDark,
  },
};
