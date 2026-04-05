/**
 * config.ts — single source of truth for all app configuration.
 * Everything reads from here. Change .env, nothing else changes.
 */
import "./env.js";

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Please check your .env file.`
    );
  }
  return value;
};

export const config = {
  // Server
  port: parseInt(process.env.PORT || "3001"),

  // MongoDB
  mongoUri: required("MONGODB_URI"),

  // Ollama / LLM
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "llama3.1:8b",
    temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || "0.1"),
    maxTokens: parseInt(process.env.OLLAMA_MAX_TOKENS || "4096"),
  },
} as const;
