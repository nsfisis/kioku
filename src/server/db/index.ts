import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";
import * as schemaCrdt from "./schema-crdt.js";

const {
	POSTGRES_USER,
	POSTGRES_PASSWORD,
	POSTGRES_DB,
	POSTGRES_HOST,
	POSTGRES_PORT,
} = process.env;

const fullSchema = { ...schema, ...schemaCrdt };

export const db: NodePgDatabase<typeof fullSchema> = drizzle(
	`postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`,
	{ schema: fullSchema },
);

export * from "./schema.js";
export * from "./schema-crdt.js";
