import { tool } from 'ai';
import { z } from 'zod';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { resolveWorkspacePath } from '@/utils/workspace';

export const writeFileTool = tool({
  description: 'Replace a unique string in a file with new content',
  inputSchema: z.object({
    path: z.string().describe('File path relative to project root (or absolute path)'),
    oldStr: z.string().describe('Exact string to find (must be unique)'),
    newStr: z.string().describe('Replacement string'),
  }),
  needsApproval: true,
  execute: async ({ path, oldStr, newStr }) => {
    const resolvedPath = resolveWorkspacePath(path);
    const content = await readFile(resolvedPath, 'utf-8');
    if (!content.includes(oldStr)) return 'Error: oldStr not found in file';
    const count = content.split(oldStr).length - 1;
    if (count > 1) return `Error: oldStr found ${count} times, must be unique`;
    const updated = content.replace(oldStr, newStr);
    await writeFile(resolvedPath, updated);
    return `Replaced in ${resolvedPath}`;
  },
});

export const readFileTool = tool({
  description: 'Read the content of a file',
  inputSchema: z.object({
    path: z.string().describe('File path relative to project root (or absolute path)'),
  }),
  execute: async ({ path }) => {
    const resolvedPath = resolveWorkspacePath(path);
    const content = await readFile(resolvedPath, 'utf-8');
    return content;
  },
});

export const createFileTool = tool({
  description: 'Create a new file with specified content',
  inputSchema: z.object({
    path: z.string().describe('File path relative to project root (or absolute path)'),
    content: z.string().describe('Content to write to the new file'),
  }),
  needsApproval: true,
  execute: async ({ path, content }) => {
    const resolvedPath = resolveWorkspacePath(path);
    await mkdir(dirname(resolvedPath), { recursive: true });
    await writeFile(resolvedPath, content);
    return `Created file at ${resolvedPath}`;
  },
});
