import { z } from "zod";

// Card states for FSRS algorithm
export const cardStateSchema = z.union([
	z.literal(0), // New
	z.literal(1), // Learning
	z.literal(2), // Review
	z.literal(3), // Relearning
]);

// Rating values for reviews
export const ratingSchema = z.union([
	z.literal(1), // Again
	z.literal(2), // Hard
	z.literal(3), // Good
	z.literal(4), // Easy
]);

// User schema
export const userSchema = z.object({
	id: z.uuid(),
	username: z.string().min(1).max(255),
	passwordHash: z.string(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

// User creation input schema
export const createUserSchema = z.object({
	username: z.string().min(1).max(255),
	password: z.string().min(15).max(255),
});

// Login input schema
export const loginSchema = z.object({
	username: z.string().min(1),
	password: z.string().min(1),
});

// Refresh token input schema
export const refreshTokenSchema = z.object({
	refreshToken: z.string().min(1),
});

// Deck schema
export const deckSchema = z.object({
	id: z.uuid(),
	userId: z.uuid(),
	name: z.string().min(1).max(255),
	description: z.string().max(1000).nullable(),
	defaultNoteTypeId: z.uuid().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	deletedAt: z.coerce.date().nullable(),
	syncVersion: z.number().int().min(0),
});

// Deck creation input schema
export const createDeckSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().max(1000).nullable().optional(),
	defaultNoteTypeId: z.uuid().nullable().optional(),
});

// Deck update input schema
export const updateDeckSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	description: z.string().max(1000).nullable().optional(),
	defaultNoteTypeId: z.uuid().nullable().optional(),
});

// Card schema
export const cardSchema = z.object({
	id: z.uuid(),
	deckId: z.uuid(),
	front: z.string().min(1),
	back: z.string().min(1),

	// FSRS fields
	state: cardStateSchema,
	due: z.coerce.date(),
	stability: z.number().min(0),
	difficulty: z.number().min(0).max(10),
	elapsedDays: z.number().int().min(0),
	scheduledDays: z.number().int().min(0),
	reps: z.number().int().min(0),
	lapses: z.number().int().min(0),
	lastReview: z.coerce.date().nullable(),

	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	deletedAt: z.coerce.date().nullable(),
	syncVersion: z.number().int().min(0),
});

// Card creation input schema
export const createCardSchema = z.object({
	front: z.string().min(1),
	back: z.string().min(1),
});

// Card update input schema
export const updateCardSchema = z.object({
	front: z.string().min(1).optional(),
	back: z.string().min(1).optional(),
});

// Field type schema
export const fieldTypeSchema = z.literal("text");

// NoteType schema
export const noteTypeSchema = z.object({
	id: z.uuid(),
	userId: z.uuid(),
	name: z.string().min(1).max(255),
	frontTemplate: z.string().min(1),
	backTemplate: z.string().min(1),
	isReversible: z.boolean(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	deletedAt: z.coerce.date().nullable(),
	syncVersion: z.number().int().min(0),
});

// NoteType creation input schema
export const createNoteTypeSchema = z.object({
	name: z.string().min(1).max(255),
	frontTemplate: z.string().min(1),
	backTemplate: z.string().min(1),
	isReversible: z.boolean().default(false),
});

// NoteType update input schema
export const updateNoteTypeSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	frontTemplate: z.string().min(1).optional(),
	backTemplate: z.string().min(1).optional(),
	isReversible: z.boolean().optional(),
});

// NoteFieldType schema
export const noteFieldTypeSchema = z.object({
	id: z.uuid(),
	noteTypeId: z.uuid(),
	name: z.string().min(1).max(255),
	order: z.number().int().min(0),
	fieldType: fieldTypeSchema,
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	deletedAt: z.coerce.date().nullable(),
	syncVersion: z.number().int().min(0),
});

// NoteFieldType creation input schema
export const createNoteFieldTypeSchema = z.object({
	name: z.string().min(1).max(255),
	order: z.number().int().min(0),
	fieldType: fieldTypeSchema.default("text"),
});

// NoteFieldType update input schema
export const updateNoteFieldTypeSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	order: z.number().int().min(0).optional(),
});

// Note schema
export const noteSchema = z.object({
	id: z.uuid(),
	deckId: z.uuid(),
	noteTypeId: z.uuid(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	deletedAt: z.coerce.date().nullable(),
	syncVersion: z.number().int().min(0),
});

// Note creation input schema (fields is a map of fieldTypeId -> value)
export const createNoteSchema = z.object({
	noteTypeId: z.uuid(),
	fields: z.record(z.uuid(), z.string()),
});

// Note update input schema
export const updateNoteSchema = z.object({
	fields: z.record(z.uuid(), z.string()),
});

// Bulk note import input schema
export const bulkCreateNotesSchema = z.object({
	notes: z.array(
		z.object({
			noteTypeId: z.uuid(),
			fields: z.record(z.uuid(), z.string()),
		}),
	),
});

// NoteFieldValue schema
export const noteFieldValueSchema = z.object({
	id: z.uuid(),
	noteId: z.uuid(),
	noteFieldTypeId: z.uuid(),
	value: z.string(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	syncVersion: z.number().int().min(0),
});

// ReviewLog schema
export const reviewLogSchema = z.object({
	id: z.uuid(),
	cardId: z.uuid(),
	userId: z.uuid(),
	rating: ratingSchema,
	state: cardStateSchema,
	scheduledDays: z.number().int().min(0),
	elapsedDays: z.number().int().min(0),
	reviewedAt: z.coerce.date(),
	durationMs: z.number().int().min(0).nullable(),
	syncVersion: z.number().int().min(0),
});

// Submit review input schema
export const submitReviewSchema = z.object({
	rating: ratingSchema,
	durationMs: z.number().int().min(0).nullable().optional(),
});

// Inferred types from schemas
export type UserSchema = z.infer<typeof userSchema>;
export type CreateUserSchema = z.infer<typeof createUserSchema>;
export type LoginSchema = z.infer<typeof loginSchema>;
export type RefreshTokenSchema = z.infer<typeof refreshTokenSchema>;
export type DeckSchema = z.infer<typeof deckSchema>;
export type CreateDeckSchema = z.infer<typeof createDeckSchema>;
export type UpdateDeckSchema = z.infer<typeof updateDeckSchema>;
export type CardSchema = z.infer<typeof cardSchema>;
export type CreateCardSchema = z.infer<typeof createCardSchema>;
export type UpdateCardSchema = z.infer<typeof updateCardSchema>;
export type ReviewLogSchema = z.infer<typeof reviewLogSchema>;
export type SubmitReviewSchema = z.infer<typeof submitReviewSchema>;
export type FieldTypeSchema = z.infer<typeof fieldTypeSchema>;
export type NoteTypeSchema = z.infer<typeof noteTypeSchema>;
export type CreateNoteTypeSchema = z.infer<typeof createNoteTypeSchema>;
export type UpdateNoteTypeSchema = z.infer<typeof updateNoteTypeSchema>;
export type NoteFieldTypeSchema = z.infer<typeof noteFieldTypeSchema>;
export type CreateNoteFieldTypeSchema = z.infer<
	typeof createNoteFieldTypeSchema
>;
export type UpdateNoteFieldTypeSchema = z.infer<
	typeof updateNoteFieldTypeSchema
>;
export type NoteSchema = z.infer<typeof noteSchema>;
export type CreateNoteSchema = z.infer<typeof createNoteSchema>;
export type UpdateNoteSchema = z.infer<typeof updateNoteSchema>;
export type BulkCreateNotesSchema = z.infer<typeof bulkCreateNotesSchema>;
export type NoteFieldValueSchema = z.infer<typeof noteFieldValueSchema>;
