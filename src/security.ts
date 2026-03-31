/**
 * Security configuration for Mati MCP Server.
 * All rules are driven by environment variables — no code changes needed.
 */

function parseCommaSeparated(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

// ── Blocked collections ──────────────────────────────────────────────
const BLOCKED_COLLECTIONS = new Set(
  parseCommaSeparated(process.env.BLOCKED_COLLECTIONS)
);

// ── Blocked fields (exact match) ─────────────────────────────────────
const BLOCKED_FIELDS = new Set(
  parseCommaSeparated(process.env.BLOCKED_FIELDS)
);

// ── Redact patterns (substring match for field names) ────────────────
const REDACT_PATTERNS = parseCommaSeparated(process.env.REDACT_PATTERNS);

// ── Max results cap ──────────────────────────────────────────────────
export const MAX_RESULTS = Math.min(
  parseInt(process.env.MAX_RESULTS || "100", 10),
  500 // hard ceiling
);

/**
 * Check if a collection is allowed to be queried.
 */
export function isCollectionAllowed(name: string): boolean {
  return !BLOCKED_COLLECTIONS.has(name.toLowerCase());
}

/**
 * Get the list of blocked collections (for error messages).
 */
export function getBlockedCollections(): string[] {
  return Array.from(BLOCKED_COLLECTIONS);
}

/**
 * Check if a field name should be redacted.
 * Uses both exact match (BLOCKED_FIELDS) and substring match (REDACT_PATTERNS).
 */
function isFieldBlocked(fieldName: string): boolean {
  const lower = fieldName.toLowerCase();

  // Exact match
  if (BLOCKED_FIELDS.has(lower)) return true;

  // Substring/pattern match (catches phone_number, email_address, etc.)
  for (const pattern of REDACT_PATTERNS) {
    if (lower.includes(pattern)) return true;
  }

  return false;
}

/**
 * Recursively strip blocked fields from a document.
 * Works on nested objects too.
 */
export function redactDocument(doc: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(doc)) {
    if (isFieldBlocked(key)) {
      continue; // skip this field entirely
    }

    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      // Recurse into nested objects
      cleaned[key] = redactDocument(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      // Recurse into arrays of objects
      cleaned[key] = value.map((item) =>
        item && typeof item === "object" && !(item instanceof Date)
          ? redactDocument(item as Record<string, unknown>)
          : item
      );
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * Redact an array of documents.
 */
export function redactDocuments(
  docs: Record<string, unknown>[]
): Record<string, unknown>[] {
  return docs.map(redactDocument);
}

/**
 * Build a MongoDB projection that excludes blocked fields.
 * This is more efficient than post-query redaction for exact-match fields,
 * as MongoDB never sends the data over the wire.
 */
export function buildExclusionProjection(): Record<string, 0> {
  const projection: Record<string, 0> = {};
  for (const field of BLOCKED_FIELDS) {
    projection[field] = 0;
  }
  return projection;
}

/**
 * Log the current security configuration (for startup diagnostics).
 */
export function logSecurityConfig(): void {
  console.error("[Mati Security] Blocked collections:", Array.from(BLOCKED_COLLECTIONS).join(", ") || "(none)");
  console.error("[Mati Security] Blocked fields:", Array.from(BLOCKED_FIELDS).join(", ") || "(none)");
  console.error("[Mati Security] Redact patterns:", REDACT_PATTERNS.join(", ") || "(none)");
  console.error("[Mati Security] Max results per query:", MAX_RESULTS);
}
