import { tool } from 'ai';
import { z } from 'zod';
import { mkdir, readdir } from 'fs/promises';
import { resolveWorkspacePath } from '@/utils/workspace';

export const createDirTool = tool({
    description: 'Create a new directory',
    inputSchema: z.object({
        path: z.string().describe('Directory path relative to project root (or absolute path)'),
    }),
    execute: async ({ path }) => {
        const resolvedPath = resolveWorkspacePath(path);
        await mkdir(resolvedPath, { recursive: true });
        return `Created directory at ${resolvedPath}`;
    },
});

export const readDirTool = tool({
    description: 'Read the contents of a directory',
    inputSchema: z.object({
        path: z.string().describe('Directory path relative to project root (or absolute path)'),
    }),
    execute: async ({ path }) => {
        const resolvedPath = resolveWorkspacePath(path);
        const entries = await readdir(resolvedPath, { withFileTypes: true });
        return entries.map((entry) => ({
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file',
        }));
    },
});
