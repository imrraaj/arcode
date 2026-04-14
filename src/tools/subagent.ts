import { tool, ToolLoopAgent } from 'ai';
import { z } from 'zod';
import { createDirTool, readDirTool } from './dir';
import { createFileTool, readFileTool, writeFileTool } from './file';
import { nvidia } from '../provider';

const DEFAULT_SUBAGENT_MODEL = 'qwen/qwen3.5-122b-a10b';

export const subAgentTool = tool({
    description: 'Run a sub-agent with a given prompt and tools',
    inputSchema: z.object({
        prompt: z.string().describe('Prompt to run the sub-agent with'),
        model: z.string().optional().describe('Optional model override for the sub-agent'),
    }),
    needsApproval: true,
    execute: async ({ model, prompt }, { abortSignal, experimental_context }) => {
        const nvidiaApiKey = (experimental_context as { nvidiaApiKey?: string } | undefined)?.nvidiaApiKey;
        if (!nvidiaApiKey) {
            return "Error: NVIDIA API key is not configured.";
        }
        const selectedModel = model?.trim() ? model.trim() : DEFAULT_SUBAGENT_MODEL;
        const agent = new ToolLoopAgent({
            model: nvidia(selectedModel, nvidiaApiKey),
            tools: {
                readFile: readFileTool,
                writeFile: writeFileTool,
                createFile: createFileTool,
                createDir: createDirTool,
                readDir: readDirTool,
            },
            instructions: 'You are a helpful assistant running a sub-agent. Use file paths relative to the project root unless an absolute path is provided.',
        });
        const response = await agent.generate({
            prompt,
            abortSignal
        });
        return response;
    },
});
