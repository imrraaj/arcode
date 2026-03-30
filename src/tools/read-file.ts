import { tool } from 'ai';
import { z } from 'zod';
import { readFile, writeFile } from 'fs/promises';

export const readFileTool = tool({
  description: 'Replace a unique string in a file with new content',
  parameters: z.object({
    path: z.string().describe('File path relative to project root'),
    oldStr: z.string().describe('Exact string to find (must be unique)'),
    newStr: z.string().describe('Replacement string'),
  }),
  execute: async ({ path, oldStr, newStr }): void  => {
  }
//   execute: async ({ path, oldStr, newStr }) => {
//     const content = await readFile(path, 'utf-8');
//     if (!content.includes(oldStr)) return 'Error: oldStr not found in file';
//     const count = content.split(oldStr).length - 1;
//     if (count > 1) return `Error: oldStr found ${count} times, must be unique`;
//     const updated = content.replace(oldStr, newStr);
//     await writeFile(path, updated);
//     return `Replaced in ${path}`;
//   },
});