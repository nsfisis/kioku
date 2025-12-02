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
	id: z.string().uuid(),
	username: z.string().min(1).max(255),
	passwordHash: z.string(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
});

// User creation input schema
export const createUserSchema = z.object({
	username: z.string().min(1).max(255),
	password: z.string().min(8).max(255),
});

// Login input schema
export const loginSchema = z.object({
	username: z.string().min(1),
	password: z.string().min(1),
});

// Deck schema
export const deckSchema = z.object({
	id: z.string().uuid(),
	userId: z.string().uuid(),
	name: z.string().min(1).max(255),
	description: z.string().max(1000).nullable(),
	newCardsPerDay: z.number().int().min(0).default(20),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	deletedAt: z.coerce.date().nullable(),
	syncVersion: z.number().int().min(0),
});

// Deck creation input schema
export const createDeckSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().max(1000).nullable().optional(),
	newCardsPerDay: z.number().int().min(0).default(20),
});

// Deck update input schema
export const updateDeckSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	description: z.string().max(1000).nullable().optional(),
	newCardsPerDay: z.number().int().min(0).optional(),
});

// Card schema
export const cardSchema = z.object({
	id: z.string().uuid(),
	deckId: z.string().uuid(),
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

// ReviewLog schema
export const reviewLogSchema = z.object({
	id: z.string().uuid(),
	cardId: z.string().uuid(),
	userId: z.string().uuid(),
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
export type DeckSchema = z.infer<typeof deckSchema>;
export type CreateDeckSchema = z.infer<typeof createDeckSchema>;
export type UpdateDeckSchema = z.infer<typeof updateDeckSchema>;
export type CardSchema = z.infer<typeof cardSchema>;
export type CreateCardSchema = z.infer<typeof createCardSchema>;
export type UpdateCardSchema = z.infer<typeof updateCardSchema>;
export type ReviewLogSchema = z.infer<typeof reviewLogSchema>;
export type SubmitReviewSchema = z.infer<typeof submitReviewSchema>;
