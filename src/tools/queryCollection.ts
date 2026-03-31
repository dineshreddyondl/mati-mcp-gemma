import { getDatabase } from "../mongo.js";
import {
  isCollectionAllowed,
  redactDocuments,
  buildExclusionProjection,
  MAX_RESULTS,
} from "../security.js";

export interface QueryCollectionParams {
  collection: string;
  filter?: Record<string, unknown>;
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
}

/**
 * Tool: query_collection
 * Queries a specific MongoDB collection with optional filter, sort, and pagination.
 * Security filters are applied automatically.
 */
export async function queryCollection(params: QueryCollectionParams): Promise<{
  documents: Record<string, unknown>[];
  count: number;
  collection: string;
  hasMore: boolean;
}> {
  const { collection, filter = {}, sort, skip = 0 } = params;

  // ── Security checkpoint 1: Collection blocklist ──
  if (!isCollectionAllowed(collection)) {
    throw new Error(
      `Access denied: The collection "${collection}" is restricted. ` +
      `Contact your administrator if you need access.`
    );
  }

  const db = await getDatabase();
  const coll = db.collection(collection);

  // Cap the limit
  const limit = Math.min(params.limit || 20, MAX_RESULTS);

  // Build query with field exclusion projection
  const projection = buildExclusionProjection();

  let cursor = coll.find(filter, { projection }).skip(skip).limit(limit + 1); // +1 to detect hasMore

  if (sort) {
    cursor = cursor.sort(sort);
  }

  const rawDocs = await cursor.toArray();

  // Check if there are more results
  const hasMore = rawDocs.length > limit;
  const docs = hasMore ? rawDocs.slice(0, limit) : rawDocs;

  // ── Security checkpoint 2: Field redaction (catches pattern-matched fields) ──
  const cleanDocs = redactDocuments(
    docs as Record<string, unknown>[]
  );

  return {
    documents: cleanDocs,
    count: cleanDocs.length,
    collection,
    hasMore,
  };
}
