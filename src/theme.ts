export const theme = {
  bg: '#1d1f21',
  bgDark: '#151718',
  fg: '#c5c8c6',
  comment: '#969896',
  red: '#cc6666',
  orange: '#de935f',
  yellow: '#f0c674',
  green: '#b5bd68',
  cyan: '#8abeb7',
  blue: '#81a2be',
  purple: '#b294bb',
  selection: '#373b41',
} as const;

export type Theme = typeof theme;