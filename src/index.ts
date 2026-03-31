import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "..", ".env") });

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { logSecurityConfig } from "./security.js";
import { closeDatabase } from "./mongo.js";
import { listCollections } from "./tools/listCollections.js";
import { queryCollection } from "./tools/queryCollection.js";
import { aggregate } from "./tools/aggregate.js";

// ── Create MCP Server ────────────────────────────────────────────────
const server = new Server(
  {
    name: "mati-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ── Register available tools ─────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_collections",
        description:
          "List all available MongoDB collections that can be queried. " +
          "Use this first to discover what data is available.",
        inputSchema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
      },
      {
        name: "query_collection",
        description:
          "Query a MongoDB collection with optional filters, sorting, and pagination. " +
          "Use this to find specific documents like pending orders, recent customers, etc. " +
          "Sensitive fields are automatically redacted from results.",
        inputSchema: {
          type: "object" as const,
          properties: {
            collection: {
              type: "string",
              description: "Name of the collection to query (e.g. 'orders', 'customers', 'products')",
            },
            filter: {
              type: "object",
              description:
                "MongoDB filter object. Examples: " +
                '{"status": "pending"} or ' +
                '{"createdAt": {"$gte": "2024-01-01"}} or ' +
                '{"amount": {"$gt": 1000}}',
            },
            sort: {
              type: "object",
              description:
                "Sort order. Use 1 for ascending, -1 for descending. " +
                'Example: {"createdAt": -1} for newest first',
            },
            limit: {
              type: "number",
              description: "Maximum documents to return (default: 20, max: 100)",
            },
            skip: {
              type: "number",
              description: "Number of documents to skip (for pagination)",
            },
          },
          required: ["collection"],
        },
      },
      {
        name: "aggregate",
        description:
          "Run a MongoDB aggregation pipeline for reporting and analytics. " +
          "Use this for grouping, counting, summing, averaging, and other aggregations. " +
          "Example: count orders by status, total revenue by month, top customers by spend.",
        inputSchema: {
          type: "object" as const,
          properties: {
            collection: {
              type: "string",
              description: "Name of the collection to aggregate",
            },
            pipeline: {
              type: "array",
              items: { type: "object" },
              description:
                "MongoDB aggregation pipeline stages. " +
                'Example: [{"$group": {"_id": "$status", "count": {"$sum": 1}}}] ' +
                "to count documents by status. " +
                "Write-stages ($out, $merge) are blocked for safety.",
            },
          },
          required: ["collection", "pipeline"],
        },
      },
    ],
  };
});

// ── Handle tool calls ────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_collections": {
        const result = await listCollections();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "query_collection": {
        const result = await queryCollection({
          collection: args?.collection as string,
          filter: args?.filter as Record<string, unknown> | undefined,
          sort: args?.sort as Record<string, 1 | -1> | undefined,
          limit: args?.limit as number | undefined,
          skip: args?.skip as number | undefined,
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "aggregate": {
        const result = await aggregate({
          collection: args?.collection as string,
          pipeline: args?.pipeline as Record<string, unknown>[],
        });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unknown error occurred";
    return {
      content: [
        {
          type: "text" as const,
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// ── Start the server ─────────────────────────────────────────────────
async function main() {
  console.error("╔══════════════════════════════════════╗");
  console.error("║     Mati MCP Server v1.0.0          ║");
  console.error("║     Back-office data reporting       ║");
  console.error("╚══════════════════════════════════════╝");
  console.error("");

  logSecurityConfig();
  console.error("");

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[Mati] MCP server running on stdio. Waiting for connections...");
}

// Graceful shutdown
process.on("SIGINT", async () => {
  await closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeDatabase();
  process.exit(0);
});

main().catch((error) => {
  console.error("[Mati] Fatal error:", error);
  process.exit(1);
});
