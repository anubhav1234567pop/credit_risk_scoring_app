import Anthropic from "@anthropic-ai/sdk";

export type Role = "system" | "user" | "assistant";
export type Message = { role: Role; content: string };
export type InvokeParams = { messages: Message[]; maxTokens?: number };
export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: Role; content: string };
    finish_reason: string | null;
  }>;
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: params.maxTokens ?? 1000,
    messages: params.messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  return {
    id: response.id,
    created: Date.now(),
    model: response.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: response.stop_reason,
      },
    ],
  };
}