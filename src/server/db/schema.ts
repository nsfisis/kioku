import {
	boolean,
	integer,
	pgTable,
	real,
	smallint,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

// Card states for FSRS algorithm
export const CardState = {
	New: 0,
	Learning: 1,
	Review: 2,
	Relearning: 3,
} as const;

// Rating values for reviews
export const Rating = {
	Again: 1,
	Hard: 2,
	Good: 3,
	Easy: 4,
} as const;

// Field types for note fields
export const FieldType = {
	Text: "text",
} as const;

export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	username: varchar("username", { length: 255 }).notNull().unique(),
	passwordHash: varchar("password_hash", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const refreshTokens = pgTable("refresh_tokens", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	tokenHash: varchar("token_hash", { length: 255 }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const noteTypes = pgTable("note_types", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id),
	name: varchar("name", { length: 255 }).notNull(),
	frontTemplate: text("front_template").notNull(),
	backTemplate: text("back_template").notNull(),
	isReversible: boolean("is_reversible").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	deletedAt: timestamp("deleted_at", { withTimezone: true }),
	syncVersion: integer("sync_version").notNull().default(0),
});

export const noteFieldTypes = pgTable("note_field_types", {
	id: uuid("id").primaryKey().defaultRandom(),
	noteTypeId: uuid("note_type_id")
		.notNull()
		.references(() => noteTypes.id),
	name: varchar("name", { length: 255 }).notNull(),
	order: integer("order").notNull(),
	fieldType: varchar("field_type", { length: 50 })
		.notNull()
		.default(FieldType.Text),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	deletedAt: timestamp("deleted_at", { withTimezone: true }),
	syncVersion: integer("sync_version").notNull().default(0),
});

export const decks = pgTable("decks", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id),
	name: varchar("name", { length: 255 }).notNull(),
	description: text("description"),
	newCardsPerDay: integer("new_cards_per_day").notNull().default(20),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	deletedAt: timestamp("deleted_at", { withTimezone: true }),
	syncVersion: integer("sync_version").notNull().default(0),
});

export const notes = pgTable("notes", {
	id: uuid("id").primaryKey().defaultRandom(),
	deckId: uuid("deck_id")
		.notNull()
		.references(() => decks.id),
	noteTypeId: uuid("note_type_id")
		.notNull()
		.references(() => noteTypes.id),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	deletedAt: timestamp("deleted_at", { withTimezone: true }),
	syncVersion: integer("sync_version").notNull().default(0),
});

export const noteFieldValues = pgTable("note_field_values", {
	id: uuid("id").primaryKey().defaultRandom(),
	noteId: uuid("note_id")
		.notNull()
		.references(() => notes.id),
	noteFieldTypeId: uuid("note_field_type_id")
		.notNull()
		.references(() => noteFieldTypes.id),
	value: text("value").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	syncVersion: integer("sync_version").notNull().default(0),
});

export const cards = pgTable("cards", {
	id: uuid("id").primaryKey().defaultRandom(),
	deckId: uuid("deck_id")
		.notNull()
		.references(() => decks.id),
	noteId: uuid("note_id")
		.notNull()
		.references(() => notes.id),
	isReversed: boolean("is_reversed").notNull(),
	front: text("front").notNull(),
	back: text("back").notNull(),

	// FSRS fields
	state: smallint("state").notNull().default(CardState.New),
	due: timestamp("due", { withTimezone: true }).notNull().defaultNow(),
	stability: real("stability").notNull().default(0),
	difficulty: real("difficulty").notNull().default(0),
	elapsedDays: integer("elapsed_days").notNull().default(0),
	scheduledDays: integer("scheduled_days").notNull().default(0),
	reps: integer("reps").notNull().default(0),
	lapses: integer("lapses").notNull().default(0),
	lastReview: timestamp("last_review", { withTimezone: true }),

	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	deletedAt: timestamp("deleted_at", { withTimezone: true }),
	syncVersion: integer("sync_version").notNull().default(0),
});

export const reviewLogs = pgTable("review_logs", {
	id: uuid("id").primaryKey().defaultRandom(),
	cardId: uuid("card_id")
		.notNull()
		.references(() => cards.id),
	userId: uuid("user_id")
		.notNull()
		.references(() => users.id),
	rating: smallint("rating").notNull(),
	state: smallint("state").notNull(),
	scheduledDays: integer("scheduled_days").notNull(),
	elapsedDays: integer("elapsed_days").notNull(),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	durationMs: integer("duration_ms"),
	syncVersion: integer("sync_version").notNull().default(0),
});

// Re-export CRDT schema
export * from "./schema-crdt";
