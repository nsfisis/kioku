/**
 * CRDT Document Storage Schema
 *
 * This module defines the PostgreSQL schema for storing Automerge CRDT documents.
 * Each CRDT document is stored as a binary blob with metadata for efficient querying.
 *
 * Design:
 * - Documents are keyed by (user_id, entity_type, entity_id) for efficient lookup
 * - Binary data stores the serialized Automerge document
 * - sync_version enables incremental sync operations
 */

import {
	index,
	integer,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

/**
 * Valid entity types for CRDT documents
 * Must match CrdtEntityType in client/sync/crdt/types.ts
 */
export const CrdtEntityType = {
	Deck: "deck",
	NoteType: "noteType",
	NoteFieldType: "noteFieldType",
	Note: "note",
	NoteFieldValue: "noteFieldValue",
	Card: "card",
	ReviewLog: "reviewLog",
} as const;

export type CrdtEntityTypeValue =
	(typeof CrdtEntityType)[keyof typeof CrdtEntityType];

/**
 * CRDT documents table
 *
 * Stores serialized Automerge documents for each entity.
 * The binary field contains the full Automerge document state.
 */
export const crdtDocuments = pgTable(
	"crdt_documents",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** User who owns this document */
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** Entity type (deck, card, note, etc.) */
		entityType: varchar("entity_type", { length: 50 }).notNull(),
		/** Entity ID (matches the entity's primary key) */
		entityId: uuid("entity_id").notNull(),
		/** Serialized Automerge document binary (stored as base64 text for simplicity) */
		binary: varchar("binary", { length: 1048576 }).notNull(),
		/** Sync version for incremental sync */
		syncVersion: integer("sync_version").notNull().default(0),
		/** When the document was created */
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		/** When the document was last updated */
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		// Unique constraint on (user_id, entity_type, entity_id)
		uniqueIndex("crdt_documents_user_entity_idx").on(
			table.userId,
			table.entityType,
			table.entityId,
		),
		// Index for querying by entity type
		index("crdt_documents_entity_type_idx").on(table.entityType),
		// Index for sync version queries
		index("crdt_documents_sync_version_idx").on(
			table.userId,
			table.syncVersion,
		),
	],
);

/**
 * Type for inserting a new CRDT document
 */
export type NewCrdtDocument = typeof crdtDocuments.$inferInsert;

/**
 * Type for a CRDT document from the database
 */
export type CrdtDocument = typeof crdtDocuments.$inferSelect;
