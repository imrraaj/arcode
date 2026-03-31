import { tavily } from '@tavily/core';
import { tool } from 'ai';
import { z } from 'zod';

export const webSearchTool = tool({
    description: "Search the web for current information. Use when the user asks about recent events, news, or anything you don't know.",
    inputSchema: z.object({
        query: z.string().describe("The search query"),
    }),
    needsApproval: true,
    execute: async ({ query }) => {
        const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY, });
        const result = await tvly.search(query, { includeAnswer: "basic", searchDepth: "advanced" });
        return result.results
            .map((r) => `**${r.title}**\n${r.url}\n${r.content}`)
            .join("\n\n---\n\n");
    },
});