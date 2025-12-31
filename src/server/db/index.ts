import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import * as schemaCrdt from "./schema-crdt.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("DATABASE_URL environment variable is not set");
}

export const db = drizzle(databaseUrl, {
	schema: { ...schema, ...schemaCrdt },
});

export * from "./schema.js";
export * from "./schema-crdt.js";
