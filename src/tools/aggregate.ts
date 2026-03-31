import { getDatabase } from "../mongo.js";
import {
  isCollectionAllowed,
  redactDocuments,
  MAX_RESULTS,
} from "../security.js";

export interface AggregateParams {
  collection: string;
  pipeline: Record<string, unknown>[];
}

/**
 * Tool: aggregate
 * Runs a MongoDB aggregation pipeline on a collection.
 * Useful for grouping, counting, summing, and reporting.
 * Security filters are applied automatically.
 */
export async function aggregate(params: AggregateParams): Promise<{
  results: Record<string, unknown>[];
  count: number;
  collection: string;
}> {
  const { collection, pipeline } = params;

  // ── Security checkpoint 1: Collection blocklist ──
  if (!isCollectionAllowed(collection)) {
    throw new Error(
      `Access denied: The collection "${collection}" is restricted. ` +
      `Contact your administrator if you need access.`
    );
  }

  // ── Security checkpoint 2: Block dangerous pipeline stages ──
  const blockedStages = ["$out", "$merge", "$collStats", "$indexStats", "$planCacheStats"];
  for (const stage of pipeline) {
    const stageKeys = Object.keys(stage);
    for (const key of stageKeys) {
      if (blockedStages.includes(key)) {
        throw new Error(
          `Access denied: The pipeline stage "${key}" is not allowed. ` +
          `Mati is configured for read-only access.`
        );
      }
    }

    // Block $lookup into restricted collections
    if ("$lookup" in stage) {
      const lookup = stage.$lookup as Record<string, unknown>;
      if (lookup.from && !isCollectionAllowed(lookup.from as string)) {
        throw new Error(
          `Access denied: Cannot join with restricted collection "${lookup.from}".`
        );
      }
    }
  }

  const db = await getDatabase();
  const coll = db.collection(collection);

  // Add a $limit at the end if none exists to prevent unbounded results
  const hasLimit = pipeline.some((stage) => "$limit" in stage);
  const safePipeline = hasLimit
    ? pipeline
    : [...pipeline, { $limit: MAX_RESULTS }];

  const rawResults = await coll.aggregate(safePipeline).toArray();

  // ── Security checkpoint 3: Field redaction on output ──
  const cleanResults = redactDocuments(
    rawResults as Record<string, unknown>[]
  );

  return {
    results: cleanResults,
    count: cleanResults.length,
    collection,
  };
}
