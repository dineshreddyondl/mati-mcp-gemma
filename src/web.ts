/**
 * web.ts — Mati Express server.
 * Supports 3 modes: internal (MongoDB), general, document.
 * Uses LLM queue for concurrent request handling.
 */
import "./env.js";
import { config } from "./config.js";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { OllamaClient, mcpToolsToLLMTools } from "./llm.js";
import type { Message, ToolDefinition } from "./llm.js";
import { llmQueue } from "./queue.js";
import { logSecurityConfig } from "./security.js";
import { getDatabase, closeDatabase } from "./mongo.js";
import { listCollections } from "./tools/listCollections.js";
import { queryCollection } from "./tools/queryCollection.js";
import { aggregate } from "./tools/aggregate.js";

// ── System prompts per mode ──────────────────────────────────────────
const SYSTEM_PROMPTS = {
  internal: `You are Mati, an internal back-office data reporting assistant for ONDL — a logistics/delivery platform.
You ONLY answer questions about ONDL's data. You do NOT answer general knowledge questions, coding questions, or anything unrelated to ONDL's business data.
If someone asks something unrelated, reply: "I can only help with ONDL order and delivery data. Switch to General mode for other questions."

═══ DATABASE SCHEMA ═══
COLLECTION: SaaS_Orders (15,000+ orders, main collection)

ORDER IDENTIFIERS: orderId, externalOrderId, shipperId
ORDER STATUS: placed, out_for_pickup, picked_up, fm_package_verified, lr_generated_and_uploaded, in_transit_to_transhipment_point, waiting_for_arrival, out_for_delivery, delivered, cancelled, rto, pickup_failed

LOCATIONS:
- start.address.mapData.city/state/pincode — pickup
- end.address.mapData.city/state/pincode — delivery

PACKAGE: package[0].weight, l/b/h, sku[0].sku_name, sku[0].qty, sku[0].sku_value, awb
COST: cost.totalCost, cost.subTotal, cost.gst, cost.shipperCost
PAYMENT: paymentStatus (successful/pending/failed), paymentInfo[0].paymentMethod (wallet/cod/online)
BUSINESS: stakeholders.bookingUserDetails.companyName, orgId, transporterDetails.companyUid
DATES: createdAt, updatedAt, estimatedDeliveryDate, metadata.pickupTimestamp
OTHER: orderType, isRtoOrder, metadata.sourceChannel
OTHER COLLECTIONS: Draft_Orders, Trips, TripInstances, Tickets

═══ QUERY RULES ═══
1. NEVER return full documents. ALWAYS use aggregate with $project.
2. For listing: project only orderId, orderStatus, createdAt, cities, cost, companyName.
3. For counting/grouping: use $group directly, never fetch all docs.
4. Default limit: 5 unless user asks for more.
5. Dates: {"createdAt": {"$gte": "2026-01-01T00:00:00.000Z"}}
6. Company: {"stakeholders.bookingUserDetails.companyName": {$regex: "wakefit", $options: "i"}}
7. Format as clean tables. Use Indian number format with commas.
8. Be concise — answer first, offer follow-ups after.`,

  general: `You are Mati, a helpful AI assistant for ONDL team members.
You can help with anything — writing, analysis, explanations, brainstorming, coding, math, or general questions.
You do NOT have access to ONDL's database in this mode.
If someone asks about specific order or delivery data, suggest switching to Internal Data mode.
Be concise, helpful, and friendly. Format responses clearly with markdown when appropriate.`,

  document: `You are Mati, a document analysis assistant for ONDL team members.
Answer questions based ONLY on the document content provided below.
If the answer is not in the document, say so clearly — do not make things up.
Be precise and reference relevant sections when possible.
Format responses clearly with markdown when appropriate.

═══ DOCUMENT CONTENT ═══
{DOCUMENT_CONTENT}`,
};

// ── Tool execution ───────────────────────────────────────────────────
async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case "list_collections":
        return JSON.stringify(await listCollections(), null, 2);
      case "query_collection":
        return JSON.stringify(await queryCollection({
          collection: args.collection as string,
          filter: args.filter as Record<string, unknown> | undefined,
          sort: args.sort as Record<string, 1 | -1> | undefined,
          limit: args.limit as number | undefined,
          skip: args.skip as number | undefined,
        }), null, 2);
      case "aggregate":
        return JSON.stringify(await aggregate({
          collection: args.collection as string,
          pipeline: args.pipeline as Record<string, unknown>[],
        }), null, 2);
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (error) {
    return JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}

function getMCPTools() {
  return [
    {
      name: "list_collections",
      description: "List all available MongoDB collections.",
      inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
    },
    {
      name: "query_collection",
      description: "Query a MongoDB collection with filters, sorting, pagination.",
      inputSchema: {
        type: "object" as const,
        properties: {
          collection: { type: "string" },
          filter: { type: "object" },
          sort: { type: "object" },
          limit: { type: "number" },
          skip: { type: "number" },
        },
        required: ["collection"],
      },
    },
    {
      name: "aggregate",
      description: "Run aggregation pipeline. Prefer for count/group/sum/average.",
      inputSchema: {
        type: "object" as const,
        properties: {
          collection: { type: "string" },
          pipeline: { type: "array", items: { type: "object" } },
        },
        required: ["collection", "pipeline"],
      },
    },
  ];
}

async function runChat(
  messages: Message[],
  tools: ToolDefinition[]
): Promise<{ content: string; toolsUsed: string[] }> {
  const toolsUsed: string[] = [];
  let response = await llm.chat(messages, tools);

  while (response.toolCalls.length > 0) {
    messages.push({ role: "assistant", content: response.content || "", tool_calls: response.toolCalls });
    for (const tc of response.toolCalls) {
      const args = JSON.parse(tc.function.arguments);
      toolsUsed.push(tc.function.name);
      console.log(`  [Tool: ${tc.function.name}]`);
      messages.push({ role: "tool", content: await executeTool(tc.function.name, args), tool_call_id: tc.id });
    }
    response = await llm.chat(messages, tools);
  }

  return { content: response.content || "(No response)", toolsUsed };
}

// ── Express app ──────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const clientPath = resolve(__dirname, "..", "client", "dist");
const clientBuilt = existsSync(clientPath);
if (clientBuilt) {
  app.use(express.static(clientPath));
  console.log(`[Mati] Serving frontend from ${clientPath}`);
} else {
  console.log(`[Mati] No frontend build found. Run 'cd client && npm run build'`);
}

let llm: OllamaClient;
let internalTools: ToolDefinition[];

// ── Health ───────────────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  try {
    const db = await getDatabase();
    res.json({
      status: "ok",
      database: db.databaseName,
      model: llm.getModel(),
      ollamaUrl: llm.getBaseUrl(),
      queueLength: llmQueue.length,
    });
  } catch (err) {
    res.status(500).json({ status: "error", error: (err as Error).message });
  }
});

// ── Chat ─────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, mode = "internal", documentContent } = req.body as {
      messages: { role: string; content: string }[];
      mode: "internal" | "general" | "document";
      documentContent?: string;
    };

    const queuePosition = llmQueue.length;
    const estimatedWait = llmQueue.getEstimatedWait(queuePosition);

    let systemPrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.internal;
    if (mode === "document" && documentContent) {
      systemPrompt = systemPrompt.replace("{DOCUMENT_CONTENT}", documentContent);
    }

    const tools = mode === "internal" ? internalTools : [];
    const llmMessages: Message[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role as Message["role"], content: m.content })),
    ];

    const reqId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await llmQueue.enqueue(reqId, () => runChat(llmMessages, tools));

    res.json({
      content: result.content,
      toolsUsed: result.toolsUsed,
      mode,
      queuePosition,
      estimatedWait,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[Mati] Error:", msg);
    res.status(500).json({ error: msg });
  }
});

// ── SPA fallback ─────────────────────────────────────────────────────
if (clientBuilt) {
  app.get("*", (_req, res) => {
    res.sendFile(resolve(clientPath, "index.html"));
  });
}

// ── Start ────────────────────────────────────────────────────────────
async function main() {
  console.log("");
  console.log("╔══════════════════════════════════════╗");
  console.log("║        Mati — AI Assistant           ║");
  console.log("║        Powered by ONDL               ║");
  console.log("╚══════════════════════════════════════╝");
  console.log("");

  logSecurityConfig();
  await getDatabase();

  llm = new OllamaClient();
  internalTools = mcpToolsToLLMTools(getMCPTools());

  app.listen(config.port, () => {
    console.log(`[Mati] Running at http://localhost:${config.port}`);
    console.log(`[Mati] Modes: internal, general, document`);
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
