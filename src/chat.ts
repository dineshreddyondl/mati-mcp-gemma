import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { createInterface } from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "..", ".env") });

import { OllamaClient, mcpToolsToLLMTools } from "./llm.js";
import type { Message, ToolCall } from "./llm.js";
import { logSecurityConfig } from "./security.js";
import { getDatabase, closeDatabase } from "./mongo.js";
import { listCollections } from "./tools/listCollections.js";
import { queryCollection } from "./tools/queryCollection.js";
import { aggregate } from "./tools/aggregate.js";

// ── System prompt for DeepSeek ───────────────────────────────────────
const SYSTEM_PROMPT = `You are Mati, an AI assistant for internal back-office data reporting.
You help users query and analyze business data from MongoDB collections.

Your capabilities:
- List available data collections
- Query specific collections with filters, sorting, and pagination
- Run aggregation pipelines for reporting (counts, sums, averages, grouping)

Guidelines:
- Always start by understanding what the user wants to know
- Use list_collections first if you're unsure what data is available
- When querying, use appropriate filters to narrow results
- Format data in a clear, readable way (tables, summaries, bullet points)
- If results are empty, suggest alternative queries
- Never expose sensitive fields — they are automatically redacted
- Be concise and business-focused in your responses
- When showing numbers, use formatting (commas, currency symbols where appropriate)
- If the user asks something you can't answer from the data, say so clearly`;

// ── Execute an MCP tool call ─────────────────────────────────────────
async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    switch (name) {
      case "list_collections": {
        const result = await listCollections();
        return JSON.stringify(result, null, 2);
      }
      case "query_collection": {
        const result = await queryCollection({
          collection: args.collection as string,
          filter: args.filter as Record<string, unknown> | undefined,
          sort: args.sort as Record<string, 1 | -1> | undefined,
          limit: args.limit as number | undefined,
          skip: args.skip as number | undefined,
        });
        return JSON.stringify(result, null, 2);
      }
      case "aggregate": {
        const result = await aggregate({
          collection: args.collection as string,
          pipeline: args.pipeline as Record<string, unknown>[],
        });
        return JSON.stringify(result, null, 2);
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return JSON.stringify({ error: message });
  }
}

// ── Get MCP tool definitions ─────────────────────────────────────────
function getMCPTools() {
  return [
    {
      name: "list_collections",
      description:
        "List all available MongoDB collections that can be queried. Use this first to discover what data is available.",
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [] as string[],
      },
    },
    {
      name: "query_collection",
      description:
        "Query a MongoDB collection with optional filters, sorting, and pagination. " +
        "Sensitive fields are automatically redacted from results.",
      inputSchema: {
        type: "object" as const,
        properties: {
          collection: {
            type: "string",
            description: "Name of the collection to query",
          },
          filter: {
            type: "object",
            description:
              'MongoDB filter. Examples: {"status": "pending"}, {"createdAt": {"$gte": "2024-01-01"}}',
          },
          sort: {
            type: "object",
            description: "Sort order. 1 = ascending, -1 = descending",
          },
          limit: {
            type: "number",
            description: "Max documents to return (default: 20, max: 100)",
          },
          skip: {
            type: "number",
            description: "Documents to skip (for pagination)",
          },
        },
        required: ["collection"],
      },
    },
    {
      name: "aggregate",
      description:
        "Run a MongoDB aggregation pipeline for reporting. " +
        "Use for grouping, counting, summing, averaging. " +
        "Write-stages ($out, $merge) are blocked.",
      inputSchema: {
        type: "object" as const,
        properties: {
          collection: {
            type: "string",
            description: "Collection to aggregate",
          },
          pipeline: {
            type: "array",
            items: { type: "object" },
            description: "MongoDB aggregation pipeline stages",
          },
        },
        required: ["collection", "pipeline"],
      },
    },
  ];
}

// ── Main chat loop ───────────────────────────────────────────────────
async function main() {
  console.log("");
  console.log("╔══════════════════════════════════════╗");
  console.log("║     Mati v2.0 — AI Data Reporter     ║");
  console.log("║     Powered by DeepSeek-V3           ║");
  console.log("╚══════════════════════════════════════╝");
  console.log("");

  logSecurityConfig();

  // Test MongoDB connection
  try {
    await getDatabase();
    console.log("");
  } catch (error) {
    console.error("[Mati] Failed to connect to MongoDB:", error);
    process.exit(1);
  }

  // Initialize Together client
  let llm: OllamaClient;
  try {
    llm = new OllamaClient();
    console.log("[Mati] Connected to Together API (DeepSeek-V3)");
  } catch (error) {
    console.error("[Mati]", error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const tools = mcpToolsToLLMTools(getMCPTools());
  const conversationHistory: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  console.log("");
  console.log('Ask me anything about your data. Type "exit" to quit.');
  console.log("─".repeat(50));
  console.log("");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (): void => {
    rl.question("You: ", async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        askQuestion();
        return;
      }

      if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
        console.log("\n[Mati] Goodbye! 👋");
        await closeDatabase();
        rl.close();
        process.exit(0);
      }

      // Add user message to history
      conversationHistory.push({ role: "user", content: trimmed });

      try {
        // Send to DeepSeek — may require multiple rounds for tool calls
        let response = await llm.chat(conversationHistory, tools);

        // Tool call loop: DeepSeek may call tools, then we feed results back
        while (response.toolCalls.length > 0) {
          // Add assistant's tool call message to history
          conversationHistory.push({
            role: "assistant",
            content: response.content || "",
            tool_calls: response.toolCalls,
          });

          // Execute each tool call
          for (const toolCall of response.toolCalls) {
            const args = JSON.parse(toolCall.function.arguments);
            console.log(
              `\n  [Querying ${toolCall.function.name}...]`
            );

            const result = await executeTool(toolCall.function.name, args);

            // Add tool result to history
            conversationHistory.push({
              role: "tool",
              content: result,
              tool_call_id: toolCall.id,
            });
          }

          // Send tool results back to DeepSeek for final answer
          response = await llm.chat(conversationHistory, tools);
        }

        // Final response from DeepSeek
        const answer = response.content || "(No response)";
        conversationHistory.push({ role: "assistant", content: answer });

        console.log(`\nMati: ${answer}\n`);
      } catch (error) {
        console.error(
          "\n[Mati] Error:",
          error instanceof Error ? error.message : error
        );
        console.log("");
      }

      askQuestion();
    });
  };

  askQuestion();
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[Mati] Shutting down...");
  await closeDatabase();
  process.exit(0);
});

main().catch((error) => {
  console.error("[Mati] Fatal error:", error);
  process.exit(1);
});
