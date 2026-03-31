import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { existsSync } from "fs";
import express from "express";
import cors from "cors";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "..", ".env") });

import { TogetherClient, mcpToolsToLLMTools } from "./llm.js";
import type { Message, ToolDefinition } from "./llm.js";
import { logSecurityConfig } from "./security.js";
import { getDatabase, closeDatabase } from "./mongo.js";
import { listCollections } from "./tools/listCollections.js";
import { queryCollection } from "./tools/queryCollection.js";
import { aggregate } from "./tools/aggregate.js";

const PORT = parseInt(process.env.PORT || "3001");

// ── System prompt with full schema knowledge ────────────────────────
const SYSTEM_PROMPT = `You are Mati, an AI assistant for internal back-office data reporting.

DATABASE SCHEMA — you already know this, DO NOT call list_collections or query with limit:1 to discover it:

Collection: SaaS_Orders (15,000+ orders)
Key fields:
- orderId: string (e.g. "TSC00570")
- orderStatus: string (placed, initiated, waiting_for_arrival, delivered, cancelled, rto, etc.)
- orderType: string (e.g. "panindia_standard_delivery")
- shipperId: string
- createdAt: Date
- updatedAt: Date
- start.contact.name, start.contact.phone — sender info
- start.address.mapData.city, .state, .pincode — pickup location
- end.contact.name, end.contact.phone — recipient info  
- end.address.mapData.city, .state, .pincode — delivery location
- package[].weight, package[].l, package[].b, package[].h — dimensions
- package[].sku[].sku_name, .qty, .sku_value — product details
- package[].status: string
- cost.totalCost, cost.shipperCost, cost.gst, cost.subTotal — pricing
- paymentStatus: string
- paymentInfo[].paymentMethod — wallet, cod, etc.
- firstMile.orderStatus, midMile.orderStatus, lastMile.orderStatus — leg statuses
- stakeholders.bookingUserDetails.companyName — business name
- stakeholders.transporterDetails.companyUid — transporter
- metadata.sourceChannel — api, web, app
- isRtoOrder: boolean

Other collections: Draft_Orders, Trips, TripInstances, Tickets, Hyp_Trips, CronJobLogs, GeneralConfig

CRITICAL RULES:
1. NEVER query full documents. These are 5000+ tokens each. Always use $project in aggregations to return ONLY the fields needed.
2. For "show me orders" → use aggregate with $project to pick only: orderId, orderStatus, createdAt, start.address.mapData.city, end.address.mapData.city, cost.totalCost
3. For counting/grouping → use $group directly, never fetch documents to count them
4. Default limit: 5 documents max unless user asks for more
5. Dates are stored as ISODate. Filter with: {"createdAt": {"$gte": {"$date": "2026-03-01T00:00:00Z"}}}
6. ALWAYS use aggregate with $project instead of query_collection — it returns much less data
7. Format output as clean tables or bullet points. Use commas for numbers.
8. Be concise — answer first, then offer follow-ups
9. You already know the schema — go straight to the query, no discovery calls needed`;

// ── Reuse the same tool execution from chat.ts ───────────────────────
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return JSON.stringify({ error: message });
  }
}

// ── Tool definitions ─────────────────────────────────────────────────
function getMCPTools() {
  return [
    {
      name: "list_collections",
      description: "List all available MongoDB collections.",
      inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
    },
    {
      name: "query_collection",
      description:
        "Query a MongoDB collection with filters, sorting, pagination. Sensitive fields are redacted.",
      inputSchema: {
        type: "object" as const,
        properties: {
          collection: { type: "string", description: "Collection name" },
          filter: { type: "object", description: "MongoDB filter" },
          sort: { type: "object", description: "Sort order (1=asc, -1=desc)" },
          limit: { type: "number", description: "Max docs (default 5, max 100)" },
          skip: { type: "number", description: "Skip for pagination" },
        },
        required: ["collection"],
      },
    },
    {
      name: "aggregate",
      description:
        "Run aggregation pipeline for reporting. Prefer over query_collection for count/group/sum/average.",
      inputSchema: {
        type: "object" as const,
        properties: {
          collection: { type: "string", description: "Collection name" },
          pipeline: { type: "array", items: { type: "object" }, description: "Pipeline stages" },
        },
        required: ["collection", "pipeline"],
      },
    },
  ];
}

// ── Express app ──────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Serve the React frontend from client/dist (only if built)
const clientPath = resolve(__dirname, "..", "client", "dist");
const clientBuilt = existsSync(clientPath);
if (clientBuilt) {
  app.use(express.static(clientPath));
}

let llm: TogetherClient;
let tools: ToolDefinition[];

// ── Chat endpoint ────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body as { messages: { role: string; content: string }[] };

    const llmMessages: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role as Message["role"], content: m.content })),
    ];

    let response = await llm.chat(llmMessages, tools);
    const toolsUsed: string[] = [];

    // Tool call loop
    while (response.toolCalls.length > 0) {
      llmMessages.push({
        role: "assistant",
        content: response.content || "",
        tool_calls: response.toolCalls,
      });

      for (const tc of response.toolCalls) {
        const args = JSON.parse(tc.function.arguments);
        toolsUsed.push(tc.function.name);
        console.log(`  [Tool: ${tc.function.name}]`);

        const result = await executeTool(tc.function.name, args);

        llmMessages.push({
          role: "tool",
          content: result,
          tool_call_id: tc.id,
        });
      }

      response = await llm.chat(llmMessages, tools);
    }

    res.json({
      content: response.content || "(No response)",
      toolsUsed,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Mati] Error:", msg);
    res.status(500).json({ error: msg });
  }
});

// ── Health endpoint ──────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  try {
    const db = await getDatabase();
    res.json({ status: "ok", database: db.databaseName });
  } catch (err) {
    res.status(500).json({ status: "error", error: (err as Error).message });
  }
});

// ── SPA fallback (only if client is built) ───────────────────────────
if (clientBuilt) {
  app.get("*", (_req, res) => {
    res.sendFile(resolve(clientPath, "index.html"));
  });
}

// ── Start ────────────────────────────────────────────────────────────
async function main() {
  console.log("");
  console.log("╔══════════════════════════════════════╗");
  console.log("║     Mati Web — AI Data Reporter      ║");
  console.log("║     Powered by DeepSeek-V3           ║");
  console.log("╚══════════════════════════════════════╝");
  console.log("");

  logSecurityConfig();

  await getDatabase();
  console.log("");

  llm = new TogetherClient();
  tools = mcpToolsToLLMTools(getMCPTools());
  console.log("[Mati] Together API ready");

  app.listen(PORT, () => {
    console.log(`[Mati] Web UI running at http://localhost:${PORT}`);
    console.log("");
  });
}

process.on("SIGINT", async () => {
  await closeDatabase();
  process.exit(0);
});

main().catch((err) => {
  console.error("[Mati] Fatal:", err);
  process.exit(1);
});
