/**
 * Together API client for DeepSeek-V3.
 * Handles sending messages, tool definitions, and processing tool calls.
 */

const TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions";
const MODEL = "deepseek-ai/DeepSeek-V3.1";

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface CompletionResponse {
  choices: {
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }[];
}

export class TogetherClient {
  private apiKey: string;

  constructor() {
    const key = process.env.TOGETHER_API_KEY;
    if (!key) {
      throw new Error(
        "TOGETHER_API_KEY environment variable is not set. " +
          "Get your key from https://api.together.xyz/settings/api-keys"
      );
    }
    this.apiKey = key;
  }

  /**
   * Send a chat completion request to Together API with tool support.
   */
  async chat(
    messages: Message[],
    tools?: ToolDefinition[]
  ): Promise<{
    content: string | null;
    toolCalls: ToolCall[];
    finishReason: string;
  }> {
    const body: Record<string, unknown> = {
      model: MODEL,
      messages,
      max_tokens: 4096,
      temperature: 0.1, // Low temp for accurate data reporting
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const response = await fetch(TOGETHER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Together API error (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as CompletionResponse;
    const choice = data.choices[0];

    return {
      content: choice.message.content,
      toolCalls: choice.message.tool_calls || [],
      finishReason: choice.finish_reason,
    };
  }
}

/**
 * Convert MCP tool schemas to Together/OpenAI-compatible tool definitions.
 */
export function mcpToolsToLLMTools(
  mcpTools: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }[]
): ToolDefinition[] {
  return mcpTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

export type { Message, ToolCall, ToolDefinition };
