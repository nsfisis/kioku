import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { CrdtEntityType } from "../db/schema-crdt.js";
import { authMiddleware, getAuthUser } from "../middleware/index.js";
import {
	type SyncPullQuery,
	type SyncPushData,
	type SyncRepository,
	syncRepository,
} from "../repositories/sync.js";

export interface SyncDependencies {
	syncRepo: SyncRepository;
}

const syncDeckSchema = z.object({
	id: z.uuid(),
	name: z.string().min(1).max(255),
	description: z.string().nullable(),
	newCardsPerDay: z.number().int().min(0).max(1000),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	deletedAt: z.string().datetime().nullable(),
});

const syncCardSchema = z.object({
	id: z.uuid(),
	deckId: z.uuid(),
	noteId: z.uuid(),
	isReversed: z.boolean(),
	front: z.string().min(1),
	back: z.string().min(1),
	state: z.number().int().min(0).max(3),
	due: z.string().datetime(),
	stability: z.number().min(0),
	difficulty: z.number().min(0),
	elapsedDays: z.number().int().min(0),
	scheduledDays: z.number().int().min(0),
	reps: z.number().int().min(0),
	lapses: z.number().int().min(0),
	lastReview: z.string().datetime().nullable(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	deletedAt: z.string().datetime().nullable(),
});

const syncReviewLogSchema = z.object({
	id: z.uuid(),
	cardId: z.uuid(),
	rating: z.number().int().min(1).max(4),
	state: z.number().int().min(0).max(3),
	scheduledDays: z.number().int().min(0),
	elapsedDays: z.number().int().min(0),
	reviewedAt: z.string().datetime(),
	durationMs: z.number().int().min(0).nullable(),
});

const syncNoteTypeSchema = z.object({
	id: z.uuid(),
	name: z.string().min(1).max(255),
	frontTemplate: z.string(),
	backTemplate: z.string(),
	isReversible: z.boolean(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	deletedAt: z.string().datetime().nullable(),
});

const syncNoteFieldTypeSchema = z.object({
	id: z.uuid(),
	noteTypeId: z.uuid(),
	name: z.string().min(1).max(255),
	order: z.number().int().min(0),
	fieldType: z.string(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	deletedAt: z.string().datetime().nullable(),
});

const syncNoteSchema = z.object({
	id: z.uuid(),
	deckId: z.uuid(),
	noteTypeId: z.uuid(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	deletedAt: z.string().datetime().nullable(),
});

const syncNoteFieldValueSchema = z.object({
	id: z.uuid(),
	noteId: z.uuid(),
	noteFieldTypeId: z.uuid(),
	value: z.string(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
});

/**
 * Schema for CRDT sync payload
 * Used for conflict-free synchronization of entity data
 */
const crdtSyncPayloadSchema = z.object({
	documentId: z.string().min(1),
	entityType: z.enum([
		CrdtEntityType.Deck,
		CrdtEntityType.NoteType,
		CrdtEntityType.NoteFieldType,
		CrdtEntityType.Note,
		CrdtEntityType.NoteFieldValue,
		CrdtEntityType.Card,
		CrdtEntityType.ReviewLog,
	]),
	entityId: z.uuid(),
	binary: z.string().min(1), // Base64-encoded Automerge binary
});

const syncPushSchema = z.object({
	decks: z.array(syncDeckSchema).default([]),
	cards: z.array(syncCardSchema).default([]),
	reviewLogs: z.array(syncReviewLogSchema).default([]),
	noteTypes: z.array(syncNoteTypeSchema).default([]),
	noteFieldTypes: z.array(syncNoteFieldTypeSchema).default([]),
	notes: z.array(syncNoteSchema).default([]),
	noteFieldValues: z.array(syncNoteFieldValueSchema).default([]),
	crdtChanges: z.array(crdtSyncPayloadSchema).default([]),
});

const syncPullQuerySchema = z.object({
	lastSyncVersion: z.coerce.number().int().min(0).default(0),
});

export function createSyncRouter(deps: SyncDependencies) {
	const { syncRepo } = deps;

	return new Hono()
		.use("*", authMiddleware)
		.post("/push", zValidator("json", syncPushSchema), async (c) => {
			const user = getAuthUser(c);
			const data = c.req.valid("json") as SyncPushData;

			const result = await syncRepo.pushChanges(user.id, data);

			return c.json(result, 200);
		})
		.get("/pull", zValidator("query", syncPullQuerySchema), async (c) => {
			const user = getAuthUser(c);
			const query = c.req.valid("query") as SyncPullQuery;

			const result = await syncRepo.pullChanges(user.id, query);

			return c.json(result, 200);
		});
}

export const sync = createSyncRouter({
	syncRepo: syncRepository,
});
