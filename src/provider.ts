import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const createNvidiaProvider = (apiKey: string) => createOpenAICompatible({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    name: 'nvidia',
    apiKey,
    includeUsage: true
});

export const nvidia = (model: string, apiKey: string) =>
    createNvidiaProvider(apiKey)(model);
