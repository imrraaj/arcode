import { tool } from 'ai';
import { z } from 'zod';
import { resolveWorkspacePath } from '../utils/workspace';

export const grepTool = tool({
    description: 'Search for a regex pattern in files within a directory',
    inputSchema: z.object({
        pattern: z.string().describe('Regex pattern to search for'),
        directory: z.string().describe('Directory path relative to the workspace root'),
    }),
    execute: async ({ pattern, directory }) => {
        const resolvedDirectory = resolveWorkspacePath(directory);
        const rg = Bun.spawn(['rg', pattern, resolvedDirectory, '--json'], {
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const [output] = await Promise.all([
            new Response(rg.stdout).text(),
            new Response(rg.stderr).text(),
            rg.exited,
        ]);
        const results = output
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(result => result && result.type === 'match')
            .map(result => ({
                file: result.data.path.text,
                line: result.data.lines.text,
                lineNumber: result.data.line_number,
            }));
        return results;
    }
});
