import { sql } from "drizzle-orm";
import { pgSequence } from "drizzle-orm/pg-core";

/**
 * Source of every sync_version value, shared by all synced tables.
 *
 * Clients pull rows with `sync_version > lastSyncVersion` and then store the
 * highest version they received as their new lastSyncVersion, so the value
 * has to be a global, monotonically increasing cursor rather than a per-row
 * revision counter. Every insert and every update takes a fresh value from
 * this sequence, which puts a row written later above every row written
 * before it, whichever table or row it is.
 */
export const syncVersionSeq = pgSequence("sync_version_seq");

/** SQL expression that allocates the next sync_version. */
export const nextSyncVersion = sql`nextval('sync_version_seq')`;
