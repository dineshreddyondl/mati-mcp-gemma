/**
 * llm.ts — Ollama client for local LLM inference.
 * Reads all config from config.ts. Never hardcodes model names or URLs.
 */
import "./env.js";
import { config } from "./config.js";

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
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = config.ollama.baseUrl;
    this.model = config.ollama.model;
    console.log(`[Mati] LLM configured → ${this.baseUrl} | model: ${this.model}`);
  }

  async chat(
    messages: Message[],
    tools?: ToolDefinition[]
  ): Promise<{
    content: string | null;
    toolCalls: ToolCall[];
    finishReason: string;
  }> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: false,
      options: {
        temperature: config.ollama.temperature,
        num_predict: config.ollama.maxTokens,
      },
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama error (${response.status}): ${errorText}\n` +
        `Model: ${this.model} at ${this.baseUrl}\n` +
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

  getModel(): string {
    return this.model;
  }

  getBaseUrl(): string {
    return this.baseUrl;
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
