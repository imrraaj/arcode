import { generateText } from 'ai';
import { nim } from './provider';
import { tools } from './tools';
import { getSystemPrompt } from './context/system-prompt';
import { conversation } from './context/conversation';

export async function runAgent(userMessage: string) {
  conversation.add({ role: 'user', content: userMessage });

  const result = await generateText({
    model: nim('deepseek-ai/deepseek-r1'),  // or whatever free model
    system: getSystemPrompt(),
    messages: conversation.getMessages(),
    tools,
    maxSteps: 15,  // max tool-call chains per turn
    onStepFinish: ({ toolCalls, toolResults }) => {
      // update UI — show what tool ran and what it returned
    },
  });

  conversation.add({ role: 'assistant', content: result.text });
  return result.text;
}