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

// Convert ISO date strings to Date objects in pipeline
function convertDates(obj: unknown): unknown {
  if (typeof obj === "string" && /^\d{4}-\d{2}-\d{2}T/.test(obj)) {
    return new Date(obj);
  }
  if (Array.isArray(obj)) return obj.map(convertDates);
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, convertDates(v)])
    );
  }
  return obj;
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

  if (!isCollectionAllowed(collection)) {
    throw new Error(
      `Access denied: The collection "${collection}" is restricted. ` +
      `Contact your administrator if you need access.`
    );
  }

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

  const hasLimit = pipeline.some((stage) => "$limit" in stage);
  const safePipeline = hasLimit
    ? pipeline
    : [...pipeline, { $limit: MAX_RESULTS }];

  const convertedPipeline = convertDates(safePipeline) as Record<string, unknown>[];
  console.log('[Aggregate Pipeline]', JSON.stringify(convertedPipeline, null, 2));

  const rawResults = await coll.aggregate(convertedPipeline).toArray();

  const cleanResults = redactDocuments(
    rawResults as Record<string, unknown>[]
  );

  return {
    results: cleanResults,
    count: cleanResults.length,
    collection,
  };
}