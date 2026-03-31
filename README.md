# Mati MCP Server

AI-powered back-office data reporting bot — Stage 1: MCP + MongoDB Atlas.

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your MongoDB Atlas connection string and security rules:

```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/mydb
MONGODB_DATABASE=mydb

BLOCKED_COLLECTIONS=salaries,auth_tokens,employee_personal
BLOCKED_FIELDS=password,aadhaar,pan_number,phone,email,customer_name,bank_account
REDACT_PATTERNS=password,aadhaar,pan,phone,mobile,email,bank,ifsc,token,secret
MAX_RESULTS=100
```

### 3. Build and run

```bash
npm run build
npm start
```

## Connect to Claude Desktop

Add this to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mati": {
      "command": "node",
      "args": ["/absolute/path/to/mati-mcp-server/dist/index.js"],
      "env": {
        "MONGODB_URI": "mongodb+srv://user:pass@cluster.mongodb.net/mydb",
        "MONGODB_DATABASE": "mydb",
        "BLOCKED_COLLECTIONS": "salaries,auth_tokens",
        "BLOCKED_FIELDS": "password,aadhaar,pan_number,phone,email,customer_name",
        "REDACT_PATTERNS": "password,aadhaar,pan,phone,mobile,email,bank,token",
        "MAX_RESULTS": "100"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

## Available tools

| Tool | Description |
|------|-------------|
| `list_collections` | Shows all queryable collections (blocked ones are hidden) |
| `query_collection` | Find documents with filters, sort, and pagination |
| `aggregate` | Run aggregation pipelines for reporting (group, count, sum) |

## Example queries you can ask Claude

- "What collections are available?"
- "Show me all pending orders"
- "List the 10 most recent orders sorted by date"
- "Count orders grouped by status"
- "What's the total revenue for this month?"
- "Show me customers from Delhi"

## Security features

- **Collection blocklist**: Entire collections can be hidden (e.g., salaries)
- **Field redaction**: Sensitive fields are stripped from results (exact + pattern match)
- **Write protection**: Aggregation stages like $out and $merge are blocked
- **Result limits**: Queries are capped at MAX_RESULTS documents
- **$lookup guard**: Joins into blocked collections are prevented

All security rules are configured via environment variables — no code changes needed.

## Project structure

```
mati-mcp-server/
├── src/
│   ├── index.ts          ← MCP server entry point
│   ├── mongo.ts          ← MongoDB connection helper
│   ├── security.ts       ← Security filters & redaction
│   └── tools/
│       ├── listCollections.ts
│       ├── queryCollection.ts
│       └── aggregate.ts
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Next stages

- **Stage 2**: Integrate Together API with DeepSeek model for LLM processing
- **Stage 3**: Build full bot interface (web UI)
