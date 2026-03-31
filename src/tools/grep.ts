import { tool } from 'ai';
import { z } from 'zod';

export const grepTool = tool({
    description: 'Search for a regex pattern in files within a directory',
    inputSchema: z.object({
        pattern: z.string().describe('Regex pattern to search for'),
        directory: z.string().describe('Directory path relative to project root (or absolute path)'),
    }),
    execute: async ({ pattern, directory }) => {
        const rg = Bun.spawn(['rg', pattern, directory, '--json']);
        const decoder = new TextDecoder();
        let output = '';
        for await (const chunk of rg.stdout) {
            const text = decoder.decode(chunk);
            output += text;
        }
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