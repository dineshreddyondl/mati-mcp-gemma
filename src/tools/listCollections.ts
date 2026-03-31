import { getDatabase } from "../mongo.js";
import { isCollectionAllowed } from "../security.js";

/**
 * Tool: list_collections
 * Lists all queryable collections in the database (excluding blocked ones).
 */
export async function listCollections(): Promise<{
  collections: string[];
  count: number;
}> {
  const db = await getDatabase();

  const allCollections = await db.listCollections().toArray();

  const allowed = allCollections
    .map((c) => c.name)
    .filter((name) => !name.startsWith("system.")) // skip system collections
    .filter(isCollectionAllowed)
    .sort();

  return {
    collections: allowed,
    count: allowed.length,
  };
}
