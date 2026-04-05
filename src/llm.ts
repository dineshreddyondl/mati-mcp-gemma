/**
 * Ollama client for Gemma 3 (local).
 * Drop-in replacement for the Together/DeepSeek client.
 * Ollama exposes an OpenAI-compatible /v1/chat/completions endpoint.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "gemma3:12b";

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

export class OllamaClient {
  /**
   * Send a chat completion request to local Ollama with tool support.
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
      stream: false,
      options: {
        temperature: 0.1, // Low temp for accurate data reporting
        num_predict: 4096,
      },
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const response = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama error (${response.status}): ${errorText}\n` +
          `Make sure Ollama is running: run 'ollama serve' in a terminal.`
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
 * Convert MCP tool schemas to Ollama/OpenAI-compatible tool definitions.
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
