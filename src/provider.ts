import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export const nvidia = createOpenAICompatible({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    name: 'nvidia',
    apiKey: process.env.NVIDIA_API_KEY!,
});