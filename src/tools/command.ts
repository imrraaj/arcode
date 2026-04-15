import { tool } from 'ai';
import { z } from 'zod';
import { resolveWorkspacePath, WORKSPACE_ROOT } from '@/utils/workspace';
import { config } from '@/utils/config';

function isBlocked(command: string): string | null {
    for (const pattern of config.tools.command.blockedPatterns) {
        if (pattern.test(command)) {
            return `Blocked: command matches unsafe pattern (${pattern.source})`;
        }
    }
    return null;
}

function truncate(text: string): string {
    const maxOutputBytes = config.tools.command.maxOutputBytes;
    if (text.length <= maxOutputBytes) return text;
    const kept = text.slice(0, maxOutputBytes);
    return `${kept}\n... [truncated — output exceeded ${maxOutputBytes} bytes]`;
}

// Exported so the LLM can call it to kill a hanging process by PID.
const runningProcs = new Map<number, ReturnType<typeof Bun.spawn>>();

export const runCommandTool = tool({
    description:
        'Run a shell command in the project working directory and return stdout/stderr. ' +
        `Specify timeoutSeconds (max ${config.tools.command.maxTimeoutSeconds}) to avoid hangs — default is ${config.tools.command.defaultTimeoutSeconds}s. ` +
        'The command is killed automatically when the timeout is reached. ' +
        'Always requires user approval before execution.',
    inputSchema: z.object({
        command: z.string().describe('Shell command to execute (run via sh -c)'),
        timeoutSeconds: z
            .number()
            .min(1)
            .max(config.tools.command.maxTimeoutSeconds)
            .default(config.tools.command.defaultTimeoutSeconds)
            .optional()
            .describe(
                `Kill the process after this many seconds (1-${config.tools.command.maxTimeoutSeconds}, default ${config.tools.command.defaultTimeoutSeconds})`
            ),
        cwd: z
            .string()
            .optional()
            .describe(
                'Working directory relative to project root. Defaults to project root. ' +
                'Cannot escape the project root.'
            ),
    }),
    needsApproval: true,
    execute: async ({
        command,
        timeoutSeconds = config.tools.command.defaultTimeoutSeconds,
        cwd,
    }, { abortSignal }) => {
        // Safety: static block check before any execution
        const blocked = isBlocked(command);
        if (blocked) return blocked;

        // Safety: resolve and constrain working directory to project root
        let safeCwd = WORKSPACE_ROOT;
        try {
            safeCwd = cwd ? resolveWorkspacePath(cwd) : WORKSPACE_ROOT;
        } catch (error) {
            return error instanceof Error ? error.message : 'Invalid working directory';
        }

        const timeoutMs = Math.min(
            timeoutSeconds,
            config.tools.command.maxTimeoutSeconds,
        ) * 1000;

        const proc = Bun.spawn(['sh', '-c', command], {
            cwd: safeCwd,
            stdout: 'pipe',
            stderr: 'pipe',
            env: {
                ...process.env,
                DEBIAN_FRONTEND: 'noninteractive',
                CI: '1',
            },
        });

        runningProcs.set(proc.pid, proc);

        // Kill when timeout fires or caller aborts (e.g. user presses ctrl+c)
        const timer = setTimeout(() => proc.kill('SIGKILL'), timeoutMs);
        abortSignal?.addEventListener('abort', () => proc.kill('SIGKILL'));

        try {
            const [stdout, stderr, exitCode] = await Promise.all([
                new Response(proc.stdout).text(),
                new Response(proc.stderr).text(),
                proc.exited,
            ]);

            const out = truncate(stdout.trim());
            const err = truncate(stderr.trim());

            const parts: string[] = [`exit code: ${exitCode}`];
            if (out) parts.push(`stdout:\n${out}`);
            if (err) parts.push(`stderr:\n${err}`);

            return parts.join('\n\n');
        } finally {
            clearTimeout(timer);
            runningProcs.delete(proc.pid);
        }
    },
});

export const killCommandTool = tool({
    description:
        'Kill a running shell command by its PID. Use this when a previous run_command appears to be hanging.',
    inputSchema: z.object({
        pid: z.number().int().describe('Process ID returned from a run_command call'),
    }),
    needsApproval: false,
    execute: async ({ pid }) => {
        const proc = runningProcs.get(pid);
        if (!proc) return `No running process with PID ${pid} found.`;
        proc.kill('SIGKILL');
        runningProcs.delete(pid);
        return `Process ${pid} killed.`;
    },
});
