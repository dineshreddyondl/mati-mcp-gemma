/**
 * env.ts — must be the FIRST import in every entry point.
 * Loads .env before any other module reads process.env.
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "..", ".env") });
