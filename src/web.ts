/**
 * web.ts — Su-Mati Express server.
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
  internal: `You are Su-Mati, an AI data assistant for ONDL.

CRITICAL RULES — NEVER BREAK THESE:
1. NEVER write out a query in text. ALWAYS call the aggregate tool directly.
2. If you need data, CALL THE TOOL IMMEDIATELY. Do not explain what you will do.
3. NEVER say "here is the pipeline" or "I will run this query" — just run it.
4. After getting tool results, format them clearly for the user.
5. If tool returns empty, say "No data found" — never make up numbers.
6. When user asks for "monthly", "quarterly" or "growth" without specifying dates,
   ALWAYS use the full data range:
   {"createdAt":{"$gte":{"$date":"2025-06-01T00:00:00.000Z"},"$lte":{"$date":"2026-04-05T00:00:00.000Z"}}}
7. For totals or "all time" queries — use NO date filter at all.
NEVER show mathematical formulas or LaTeX expressions like \( \frac{} \).
   Always show only the final calculated result as a plain number.
   Example: "Jun→Jul: +96.7%" NOT "\( \frac{438-223}{223} \times 100 \)"


═══ VERIFIED DATABASE SCHEMA ═══
COLLECTION: SaaS_Orders (15,000+ orders)

TOP LEVEL FIELDS:
- orderId: string (e.g. "WKFT08002")
- orderStatus: string — placed, out_for_pickup, picked_up, fm_package_verified,
  lr_generated_and_uploaded, in_transit_to_transhipment_point, in_transit_to_destination_city,
  waiting_for_arrival, out_for_delivery, delivered, cancelled, rto, pickup_failed
- isRtoOrder: boolean
- shipperFulfillmentType: string (e.g. "dap-pan")
- paymentStatus: string ("successful", "pending", "failed")
- createdAt: ISODate
- updatedAt: ISODate
- estimatedDeliveryDate: ISODate

PICKUP LOCATION (start):
- start.address.mapData.city
- start.address.mapData.state
- start.address.mapData.pincode

DELIVERY LOCATION (end):
- end.address.mapData.city
- end.address.mapData.state
- end.address.mapData.pincode

PACKAGE (array — use package[0] or $unwind):
- package.weight (kg)
- package.l, package.b, package.h (dimensions in cm)
- package.awb (airway bill)
- package.status (package-level status)
- package.pkgType ("gunny bag", "carton box", etc.)
- package.cost (package cost as number)
- package.sku[0].sku_name, sku[0].qty, sku[0].sku_value

PAYMENT:
- paymentStatus: "successful", "pending", "failed"
- paymentInfo[0].paymentMethod: "wallet", "cod", "online"
- paymentInfo[0].paid: boolean

STAKEHOLDERS:
- stakeholders.bookingUserDetails.companyName (e.g. "Wakefit innovation", "Duroflex", "The sleep company")
- stakeholders.bookingUserDetails.orgId
- stakeholders.transporterDetails.companyUid

MILE-WISE:
- firstMile.orderStatus, firstMile.city
- midMile.orderStatus, midMile.city
- lastMile.orderStatus, lastMile.city

IMPORTANT DATE CONTEXT:
- Data exists from June 2025 to April 2026 ONLY
- Current date is April 2026
- NEVER query dates before June 2025
- For "last 3 months": createdAt >= 2026-01-01
- For "last month": createdAt >= 2026-03-01 and < 2026-04-01
- For "this month": createdAt >= 2026-04-01
- For "all time" or "total" — NO date filter

═══ QUERY RULES ═══
1. NEVER return full documents. ALWAYS use aggregate with $project.
2. For counting/grouping: use $group directly.
3. Default limit: 10 unless user asks for more.
4. For revenue/cost: use package[0].cost — first $unwind packages then $group with $sum on "package.cost".
5. Company filter: {"stakeholders.bookingUserDetails.companyName": {"$regex": "wakefit", "$options": "i"}}
6. RTO filter: {"$or": [{"orderStatus": "rto"}, {"isRtoOrder": true}]}
7. Delivered filter: {"orderStatus": "delivered"}
8. Aging orders (pending > N days): {"orderStatus": {"$nin": ["delivered","cancelled","rto"]}, "createdAt": {"$lte": <date N days ago>}}
9. Format as clean markdown tables. Use Indian number format with commas.
10. Be concise — answer first, offer follow-ups after.

═══ VERIFIED EXAMPLE QUERIES ═══
Q: "Total orders count" →
aggregate SaaS_Orders with pipeline: [{"$count":"total"}]

Q: "Customer wise order distribution last 3 months" →
aggregate SaaS_Orders with pipeline: [{"$match":{"createdAt":{"$gte":new Date("2026-01-01T00:00:00.000Z")}}},{"$group":{"_id":"$stakeholders.bookingUserDetails.companyName","orders":{"$sum":1}}},{"$sort":{"orders":-1}},{"$limit":10}]

Q: "Monthly order count" →
aggregate SaaS_Orders with pipeline: [{"$project":{"yearMonth":{"$dateToString":{"date":"$createdAt","format":"%Y-%m"}}}},{"$group":{"_id":"$yearMonth","count":{"$sum":1}}},{"$sort":{"_id":1}}]

Q: "Total RTO shipments" →
aggregate SaaS_Orders with pipeline: [{"$match":{"$or":[{"orderStatus":"rto"},{"isRtoOrder":true}]}},{"$count":"totalRTO"}]

Q: "Aging orders more than 10 days" →
aggregate SaaS_Orders with pipeline: [{"$match":{"orderStatus":{"$nin":["delivered","cancelled","rto"]},"createdAt":{"$lte":new Date(Date.now()-10*24*60*60*1000)}}},{"$project":{"orderId":1,"orderStatus":1,"createdAt":1,"company":"$stakeholders.bookingUserDetails.companyName","city":"$end.address.mapData.city"}},{"$limit":20}]

Q: "Client wise performance report" →
aggregate SaaS_Orders with pipeline: [{"$group":{"_id":"$stakeholders.bookingUserDetails.companyName","total":{"$sum":1},"delivered":{"$sum":{"$cond":[{"$eq":["$orderStatus","delivered"]},1,0]}},"rto":{"$sum":{"$cond":[{"$or":[{"$eq":["$orderStatus","rto"]},{"$eq":["$isRtoOrder",true]}]},1,0]}}}},{"$sort":{"total":-1}},{"$limit":10}]

Q: "Order status breakdown" →
aggregate SaaS_Orders with pipeline: [{"$group":{"_id":"$orderStatus","count":{"$sum":1}}},{"$sort":{"count":-1}}]

Q: "City wise delivery volume" →
aggregate SaaS_Orders with pipeline: [{"$group":{"_id":"$end.address.mapData.city","count":{"$sum":1}}},{"$sort":{"count":-1}},{"$limit":15}]`,

  general: `You are Su-Mati, a helpful AI assistant for ONDL team members.
You can help with anything — writing, analysis, explanations, brainstorming, coding, math, or general questions.
You do NOT have access to ONDL's database in this mode.
If someone asks about specific order or delivery data, suggest switching to Internal Data mode.
Be concise, helpful, and friendly. Format responses clearly with markdown when appropriate.`,

  document: `You are Su-Mati, a document analysis assistant for ONDL team members.
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
      console.log(`  [Tool: ${tc.function.name}] ${tc.function.arguments}`);
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
  console.log(`[Su-Mati] Serving frontend from ${clientPath}`);
} else {
  console.log(`[Su-Mati] No frontend build found. Run 'cd client && npm run build'`);
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
    console.error("[Su-Mati] Error:", msg);
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
  console.log("║       Su-Mati — AI Assistant         ║");
  console.log("║       Powered by ONDL                ║");
  console.log("╚══════════════════════════════════════╝");
  console.log("");

  logSecurityConfig();
  await getDatabase();

  llm = new OllamaClient();
  internalTools = mcpToolsToLLMTools(getMCPTools());

  app.listen(config.port, () => {
    console.log(`[Su-Mati] Running at http://localhost:${config.port}`);
    console.log(`[Su-Mati] Modes: internal, general, document`);
    console.log("");
  });
}

process.on("SIGINT", async () => {
  await closeDatabase();
  process.exit(0);
});

main().catch((err) => {
  console.error("[Su-Mati] Fatal:", err);
  process.exit(1);
});