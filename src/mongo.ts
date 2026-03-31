import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Get a connected MongoDB database instance.
 * Reuses the connection across calls.
 */
export async function getDatabase(): Promise<Db> {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI environment variable is not set. " +
      "Please set it to your MongoDB Atlas connection string."
    );
  }

  const dbName = process.env.MONGODB_DATABASE;

  client = new MongoClient(uri);
  await client.connect();

  db = dbName ? client.db(dbName) : client.db();

  console.error(`[Mati] Connected to MongoDB database: ${db.databaseName}`);
  return db;
}

/**
 * Close the MongoDB connection gracefully.
 */
export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.error("[Mati] MongoDB connection closed.");
  }
}
