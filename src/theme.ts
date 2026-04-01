export const theme = {
  bg: '#1a1b26',
  bgDark: '#16161e',
  fg: '#c0caf5',
  comment: '#565f89',
  red: '#f7768e',
  orange: '#ff9e64',
  yellow: '#e0af68',
  green: '#9ece6a',
  cyan: '#7dcfff',
  blue: '#7aa2f7',
  purple: '#bb9af7',
  selection: '#283457',
} as const;

export type Theme = typeof theme;
