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

import { OllamaClient, mcpToolsToLLMTools } from "./llm.js";  // ← changed
import type { Message, ToolDefinition } from "./llm.js";
import { logSecurityConfig } from "./security.js";
import { getDatabase, closeDatabase } from "./mongo.js";
import { listCollections } from "./tools/listCollections.js";
import { queryCollection } from "./tools/queryCollection.js";
import { aggregate } from "./tools/aggregate.js";

const PORT = parseInt(process.env.PORT || "3001");

// ── System prompt with full schema knowledge ────────────────────────
const SYSTEM_PROMPT = `You are Mati, an internal back-office data reporting assistant for ONDL — a logistics/delivery platform.
You ONLY answer questions about ONDL's data. You do NOT answer general knowledge questions, coding questions, or anything unrelated to ONDL's business data.

If someone asks something unrelated, reply: "I can only help with ONDL order and delivery data. Try asking about orders, deliveries, revenue, or performance."

═══ DATABASE SCHEMA ═══
You already know the schema. NEVER call list_collections or query_collection with limit:1 to discover it.

COLLECTION: SaaS_Orders (15,000+ orders, main collection)

ORDER IDENTIFIERS:
- orderId: string (e.g. "TSC00570", "WKFT08002")
- externalOrderId: string (client's order ID)
- shipperId: string (transporter identifier e.g. "sindhu-parcels-services-", "a1-speed-parcels")

ORDER STATUS (field: orderStatus) — possible values:
- "placed" — order just created
- "out_for_pickup" — driver dispatched to pick up
- "picked_up" — package collected from sender
- "fm_package_verified" — first mile package verified
- "lr_generated_and_uploaded" — lorry receipt generated
- "in_transit_to_transhipment_point" — moving between hubs
- "waiting_for_arrival" — waiting at hub
- "out_for_delivery" — last mile driver dispatched
- "delivered" — successfully delivered
- "cancelled" — order cancelled
- "rto" — return to origin
- "pickup_failed" — could not pick up

LOCATIONS:
- start.address.mapData.city — pickup city
- start.address.mapData.state — pickup state
- start.address.mapData.pincode — pickup pincode
- end.address.mapData.city — delivery city
- end.address.mapData.state — delivery state
- end.address.mapData.pincode — delivery pincode

CONTACTS (sensitive — auto-redacted):
- start.contact.name — sender name
- end.contact.name — recipient name

PACKAGE INFO:
- package[0].weight — weight in kg
- package[0].l, package[0].b, package[0].h — dimensions (cm)
- package[0].sku[0].sku_name — product name
- package[0].sku[0].qty — quantity
- package[0].sku[0].sku_value — product value
- package[0].status — package-level status
- package[0].pkgType — "carton box", "gunny bag", etc.
- package[0].awb — airway bill number

COST & PAYMENT:
- cost.totalCost — total cost including GST (number)
- cost.subTotal — cost before GST
- cost.gst — GST amount
- cost.shipperCost — shipper cost
- cost.userCostBreakdown.totalDistance — distance in km
- paymentStatus: "successful", "pending", "failed"
- paymentInfo[0].paymentMethod: "wallet", "cod", "online"

BUSINESS & STAKEHOLDERS:
- stakeholders.bookingUserDetails.companyName — business client name (e.g. "Wakefit innovation", "The sleep company", "Duroflex")
- stakeholders.bookingUserDetails.orgId — business org ID
- stakeholders.transporterDetails.companyUid — transporter ID
- stakeholders.firstMileAgentDetails.companyName — FM hub name
- stakeholders.lastMileAgentDetails.companyName — LM hub name
- stakeholders.fmAppAgentDetails.companyName — FM app agent

MILE-WISE STATUS:
- firstMile.orderStatus — first mile status
- firstMile.city — FM city
- midMile.orderStatus — mid mile status
- midMile.city — MM city
- lastMile.orderStatus — last mile status
- lastMile.city — LM city

DATES:
- createdAt — order creation date (ISODate)
- updatedAt — last update date
- estimatedDeliveryDate — EDD (ISODate, may not exist on all orders)
- metadata.pickupTimestamp — when package was picked up

OTHER FIELDS:
- orderType: "panindia_standard_delivery" (main type)
- isRtoOrder: boolean
- metadata.sourceChannel: "api", "dashboard", "app"
- shipperFulfillmentType: "dap-pan"

OTHER COLLECTIONS (rarely queried):
- Draft_Orders, Trips, TripInstances, Tickets, Hyp_Trips, CronJobLogs, GeneralConfig

═══ QUERY RULES ═══
1. NEVER return full documents — they are 5000+ tokens each. ALWAYS use aggregate with $project.
2. For listing orders: $project only orderId, orderStatus, createdAt, "start.address.mapData.city", "end.address.mapData.city", "cost.totalCost", "stakeholders.bookingUserDetails.companyName"
3. For counting/grouping: use $group directly, never fetch all documents
4. Default limit: 5 unless user asks for more
5. Dates are ISODate. Use: {"createdAt": {"$gte": "2026-01-01T00:00:00.000Z"}}
6. For company-specific queries, filter by: {"stakeholders.bookingUserDetails.companyName": {$regex: "wakefit", $options: "i"}}
7. For delivery rate: count delivered vs total orders
8. For RTO rate: count where isRtoOrder is true OR orderStatus is "rto"
9. For revenue: $group with $sum on "cost.totalCost"
10. For city-wise: $group by "end.address.mapData.city" or "start.address.mapData.city"
11. For transporter performance: $group by "stakeholders.transporterDetails.companyUid"
12. ALWAYS respond with data from the database. NEVER make up data or respond with unrelated content.
13. Format as clean tables or bullet points. Use Indian number format with commas.
14. Be concise — answer first, offer follow-ups after.

═══ EXAMPLE QUERIES ═══
Q: "How many orders this month?" →
aggregate SaaS_Orders: [{"$match":{"createdAt":{"$gte":"2026-04-01T00:00:00Z"}}},{"$count":"total"}]

Q: "Order status breakdown" →
aggregate SaaS_Orders: [{"$group":{"_id":"$orderStatus","count":{"$sum":1}}},{"$sort":{"count":-1}}]

Q: "Wakefit orders" →
aggregate SaaS_Orders: [{"$match":{"stakeholders.bookingUserDetails.companyName":{"$regex":"wakefit","$options":"i"}}},{"$group":{"_id":"$orderStatus","count":{"$sum":1}}}]

Q: "Revenue by company" →
aggregate SaaS_Orders: [{"$group":{"_id":"$stakeholders.bookingUserDetails.companyName","revenue":{"$sum":"$cost.totalCost"},"orders":{"$sum":1}}},{"$sort":{"revenue":-1}},{"$limit":10}]

Q: "City-wise delivery distribution" →
aggregate SaaS_Orders: [{"$group":{"_id":"$end.address.mapData.city","count":{"$sum":1}}},{"$sort":{"count":-1}},{"$limit":15}]

Q: "Delivery success rate" →
aggregate SaaS_Orders: [{"$group":{"_id":"$orderStatus","count":{"$sum":1}}}] then calculate delivered/total

Q: "Show latest 5 orders" →
aggregate SaaS_Orders: [{"$sort":{"createdAt":-1}},{"$limit":5},{"$project":{"orderId":1,"orderStatus":1,"createdAt":1,"pickup":"$start.address.mapData.city","delivery":"$end.address.mapData.city","cost":"$cost.totalCost","company":"$stakeholders.bookingUserDetails.companyName"}}]`;

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

let llm: OllamaClient;                    // ← changed
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
  console.log("║     Powered by Gemma 3 (Local)       ║");  // ← changed
  console.log("╚══════════════════════════════════════╝");
  console.log("");

  logSecurityConfig();

  await getDatabase();
  console.log("");

  llm = new OllamaClient();                                  // ← changed
  tools = mcpToolsToLLMTools(getMCPTools());
  console.log(`[Mati] Ollama ready → ${OLLAMA_BASE_URL} (${MODEL})`);  // ← changed

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
