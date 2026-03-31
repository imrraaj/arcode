import { tool } from 'ai';
import { z } from 'zod';
import { resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';

const PROJECT_ROOT =
    process.env.ARC_WORKSPACE_ROOT ??
    resolve(fileURLToPath(new URL('../../', import.meta.url)));

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 50_000; // 50 KB cap to avoid flooding context

/**
 * Patterns that are unconditionally blocked regardless of user approval.
 * These represent irreversible or catastrophic system operations.
 */
const BLOCKED_PATTERNS: RegExp[] = [
    /rm\s+(-[a-z]*r[a-z]*f[a-z]*|-[a-z]*f[a-z]*r[a-z]*)\s+\//i, // rm -rf /  and variants
    /\bdd\b.*of=\/dev\//i,           // dd writing to raw devices
    /\bmkfs\b/i,                     // filesystem format
    /\bshutdown\b|\breboot\b|\bhalt\b|\bpoweroff\b/i, // system shutdown
    /:\(\)\s*\{.*\|.*&.*\}/,         // fork bomb :(){ :|:& };:
    /\bsudo\s+rm\b/i,                // sudo rm
];

function isBlocked(command: string): string | null {
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(command)) {
            return `Blocked: command matches unsafe pattern (${pattern.source})`;
        }
    }
    return null;
}

function truncate(text: string): string {
    if (text.length <= MAX_OUTPUT_BYTES) return text;
    const kept = text.slice(0, MAX_OUTPUT_BYTES);
    return `${kept}\n... [truncated — output exceeded ${MAX_OUTPUT_BYTES} bytes]`;
}

// Exported so the LLM can call it to kill a hanging process by PID.
const runningProcs = new Map<number, ReturnType<typeof Bun.spawn>>();

export const runCommandTool = tool({
    description:
        'Run a shell command in the project working directory and return stdout/stderr. ' +
        'Specify timeoutSeconds (max 120) to avoid hangs — default is 30s. ' +
        'The command is killed automatically when the timeout is reached. ' +
        'Always requires user approval before execution.',
    inputSchema: z.object({
        command: z.string().describe('Shell command to execute (run via sh -c)'),
        timeoutSeconds: z
            .number()
            .min(1)
            .max(120)
            .default(30)
            .optional()
            .describe('Kill the process after this many seconds (1-120, default 30)'),
        cwd: z
            .string()
            .optional()
            .describe(
                'Working directory relative to project root. Defaults to project root. ' +
                'Cannot escape the project root.'
            ),
    }),
    needsApproval: true,
    execute: async ({ command, timeoutSeconds = 30, cwd }, { abortSignal }) => {
        // Safety: static block check before any execution
        const blocked = isBlocked(command);
        if (blocked) return blocked;

        // Safety: resolve and constrain working directory to project root
        const rawCwd = cwd ? resolve(PROJECT_ROOT, cwd) : PROJECT_ROOT;
        const safeCwd = rawCwd.startsWith(PROJECT_ROOT) ? rawCwd : PROJECT_ROOT;

        const timeoutMs = Math.min(timeoutSeconds, 120) * 1000;

        const proc = Bun.spawn(['sh', '-c', command], {
            cwd: safeCwd,
            stdout: 'pipe',
            stderr: 'pipe',
            env: {
                ...process.env,
                // Prevent interactive prompts from hanging the process
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