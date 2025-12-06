import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("DATABASE_URL environment variable is not set");
}

export const db = drizzle(databaseUrl, { schema });

export * from "./schema.js";
