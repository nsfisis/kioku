import { Hono } from "hono";
import { sign } from "hono/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardState } from "../db/schema.js";
import { errorHandler } from "../middleware/index.js";
import type {
	Card,
	CreateNoteResult,
	Deck,
	DeckRepository,
	Note,
	NoteFieldValue,
	NoteRepository,
	NoteWithFieldValues,
} from "../repositories/index.js";
import { createNotesRouter } from "./notes.js";

function createMockNoteRepo(): NoteRepository {
	return {
		findByDeckId: vi.fn(),
		findById: vi.fn(),
		findByIdWithFieldValues: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		softDelete: vi.fn(),
		createMany: vi.fn(),
	};
}

function createMockDeckRepo(): DeckRepository {
	return {
		findByUserId: vi.fn(),
		findById: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		softDelete: vi.fn(),
	};
}

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

async function createTestToken(userId: string): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	return sign(
		{
			sub: userId,
			iat: now,
			exp: now + 900,
		},
		JWT_SECRET,
	);
}

function createMockDeck(overrides: Partial<Deck> = {}): Deck {
	return {
		id: "deck-uuid-123",
		userId: "user-uuid-123",
		name: "Test Deck",
		description: "Test description",
		newCardsPerDay: 20,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		deletedAt: null,
		syncVersion: 0,
		...overrides,
	};
}

function createMockNote(overrides: Partial<Note> = {}): Note {
	return {
		id: "note-uuid-123",
		deckId: "deck-uuid-123",
		noteTypeId: "note-type-uuid-123",
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		deletedAt: null,
		syncVersion: 0,
		...overrides,
	};
}

function createMockNoteFieldValue(
	overrides: Partial<NoteFieldValue> = {},
): NoteFieldValue {
	return {
		id: "field-value-uuid-123",
		noteId: "note-uuid-123",
		noteFieldTypeId: "field-type-uuid-123",
		value: "Test value",
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		syncVersion: 0,
		...overrides,
	};
}

function createMockCard(overrides: Partial<Card> = {}): Card {
	return {
		id: "card-uuid-123",
		deckId: "deck-uuid-123",
		noteId: "note-uuid-123",
		isReversed: false,
		front: "Question",
		back: "Answer",
		state: CardState.New,
		due: new Date("2024-01-01"),
		stability: 0,
		difficulty: 0,
		elapsedDays: 0,
		scheduledDays: 0,
		reps: 0,
		lapses: 0,
		lastReview: null,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		deletedAt: null,
		syncVersion: 0,
		...overrides,
	};
}

interface NoteResponse {
	note?: Note | NoteWithFieldValues;
	notes?: Note[];
	fieldValues?: NoteFieldValue[];
	cards?: Card[];
	success?: boolean;
	error?: {
		code: string;
		message: string;
	};
}

const DECK_ID = "00000000-0000-4000-8000-000000000001";
const NOTE_ID = "00000000-0000-4000-8000-000000000002";
const NOTE_TYPE_ID = "00000000-0000-4000-8000-000000000003";
const FIELD_TYPE_ID = "00000000-0000-4000-8000-000000000004";
const BACK_FIELD_TYPE_ID = "00000000-0000-4000-8000-000000000005";

describe("GET /api/decks/:deckId/notes", () => {
	let app: Hono;
	let mockNoteRepo: ReturnType<typeof createMockNoteRepo>;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockNoteRepo = createMockNoteRepo();
		mockDeckRepo = createMockDeckRepo();
		const notesRouter = createNotesRouter({
			noteRepo: mockNoteRepo,
			deckRepo: mockDeckRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks/:deckId/notes", notesRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("returns empty array when deck has no notes", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockNoteRepo.findByDeckId).mockResolvedValue([]);

		const res = await app.request(`/api/decks/${DECK_ID}/notes`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as NoteResponse;
		expect(body.notes).toEqual([]);
		expect(mockDeckRepo.findById).toHaveBeenCalledWith(
			DECK_ID,
			"user-uuid-123",
		);
		expect(mockNoteRepo.findByDeckId).toHaveBeenCalledWith(DECK_ID);
	});

	it("returns notes for deck", async () => {
		const mockNotes = [
			createMockNote({ id: "note-1", deckId: DECK_ID }),
			createMockNote({ id: "note-2", deckId: DECK_ID }),
		];
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockNoteRepo.findByDeckId).mockResolvedValue(mockNotes);

		const res = await app.request(`/api/decks/${DECK_ID}/notes`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as NoteResponse;
		expect(body.notes).toHaveLength(2);
	});

	it("returns 404 for non-existent deck", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(`/api/decks/${DECK_ID}/notes`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteResponse;
		expect(body.error?.code).toBe("DECK_NOT_FOUND");
	});

	it("returns 400 for invalid deck uuid", async () => {
		const res = await app.request("/api/decks/invalid-id/notes", {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(`/api/decks/${DECK_ID}/notes`, {
			method: "GET",
		});

		expect(res.status).toBe(401);
	});
});

describe("POST /api/decks/:deckId/notes", () => {
	let app: Hono;
	let mockNoteRepo: ReturnType<typeof createMockNoteRepo>;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockNoteRepo = createMockNoteRepo();
		mockDeckRepo = createMockDeckRepo();
		const notesRouter = createNotesRouter({
			noteRepo: mockNoteRepo,
			deckRepo: mockDeckRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks/:deckId/notes", notesRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("creates a new note with cards", async () => {
		const mockResult: CreateNoteResult = {
			note: createMockNote({
				id: NOTE_ID,
				deckId: DECK_ID,
				noteTypeId: NOTE_TYPE_ID,
			}),
			fieldValues: [
				createMockNoteFieldValue({
					noteId: NOTE_ID,
					noteFieldTypeId: FIELD_TYPE_ID,
					value: "Front content",
				}),
			],
			cards: [
				createMockCard({ id: "card-1", deckId: DECK_ID, noteId: NOTE_ID }),
			],
		};

		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockNoteRepo.create).mockResolvedValue(mockResult);

		const res = await app.request(`/api/decks/${DECK_ID}/notes`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				noteTypeId: NOTE_TYPE_ID,
				fields: { [FIELD_TYPE_ID]: "Front content" },
			}),
		});

		expect(res.status).toBe(201);
		const body = (await res.json()) as NoteResponse;
		expect(body.note?.id).toBe(NOTE_ID);
		expect(body.fieldValues).toHaveLength(1);
		expect(body.cards).toHaveLength(1);
		expect(mockNoteRepo.create).toHaveBeenCalledWith(DECK_ID, {
			noteTypeId: NOTE_TYPE_ID,
			fields: { [FIELD_TYPE_ID]: "Front content" },
		});
	});

	it("creates a reversible note with two cards", async () => {
		const mockResult: CreateNoteResult = {
			note: createMockNote({
				id: NOTE_ID,
				deckId: DECK_ID,
				noteTypeId: NOTE_TYPE_ID,
			}),
			fieldValues: [
				createMockNoteFieldValue({ noteId: NOTE_ID, value: "Front" }),
				createMockNoteFieldValue({ noteId: NOTE_ID, value: "Back" }),
			],
			cards: [
				createMockCard({ id: "card-1", isReversed: false }),
				createMockCard({ id: "card-2", isReversed: true }),
			],
		};

		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockNoteRepo.create).mockResolvedValue(mockResult);

		const res = await app.request(`/api/decks/${DECK_ID}/notes`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				noteTypeId: NOTE_TYPE_ID,
				fields: { [FIELD_TYPE_ID]: "Front", [BACK_FIELD_TYPE_ID]: "Back" },
			}),
		});

		expect(res.status).toBe(201);
		const body = (await res.json()) as NoteResponse;
		expect(body.cards).toHaveLength(2);
	});

	it("returns 404 for non-existent deck", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(`/api/decks/${DECK_ID}/notes`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				noteTypeId: NOTE_TYPE_ID,
				fields: { [FIELD_TYPE_ID]: "Content" },
			}),
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteResponse;
		expect(body.error?.code).toBe("DECK_NOT_FOUND");
	});

	it("returns 404 for non-existent note type", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockNoteRepo.create).mockRejectedValue(
			new Error("Note type not found"),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/notes`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				noteTypeId: NOTE_TYPE_ID,
				fields: { [FIELD_TYPE_ID]: "Content" },
			}),
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteResponse;
		expect(body.error?.code).toBe("NOTE_TYPE_NOT_FOUND");
	});

	it("returns 400 for missing noteTypeId", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/notes`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				fields: { [FIELD_TYPE_ID]: "Content" },
			}),
		});

		expect(res.status).toBe(400);
	});

	it("returns 400 for missing fields", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/notes`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				noteTypeId: NOTE_TYPE_ID,
			}),
		});

		expect(res.status).toBe(400);
	});

	it("returns 400 for invalid noteTypeId uuid", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/notes`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				noteTypeId: "invalid-uuid",
				fields: { [FIELD_TYPE_ID]: "Content" },
			}),
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(`/api/decks/${DECK_ID}/notes`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				noteTypeId: NOTE_TYPE_ID,
				fields: { [FIELD_TYPE_ID]: "Content" },
			}),
		});

		expect(res.status).toBe(401);
	});
});

describe("GET /api/decks/:deckId/notes/:noteId", () => {
	let app: Hono;
	let mockNoteRepo: ReturnType<typeof createMockNoteRepo>;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockNoteRepo = createMockNoteRepo();
		mockDeckRepo = createMockDeckRepo();
		const notesRouter = createNotesRouter({
			noteRepo: mockNoteRepo,
			deckRepo: mockDeckRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks/:deckId/notes", notesRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("returns note with field values", async () => {
		const mockNoteWithFields: NoteWithFieldValues = {
			...createMockNote({ id: NOTE_ID, deckId: DECK_ID }),
			fieldValues: [
				createMockNoteFieldValue({ noteId: NOTE_ID, value: "Front" }),
				createMockNoteFieldValue({ noteId: NOTE_ID, value: "Back" }),
			],
		};

		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockNoteRepo.findByIdWithFieldValues).mockResolvedValue(
			mockNoteWithFields,
		);

		const res = await app.request(`/api/decks/${DECK_ID}/notes/${NOTE_ID}`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as NoteResponse;
		expect(body.note?.id).toBe(NOTE_ID);
		expect((body.note as NoteWithFieldValues)?.fieldValues).toHaveLength(2);
		expect(mockNoteRepo.findByIdWithFieldValues).toHaveBeenCalledWith(
			NOTE_ID,
			DECK_ID,
		);
	});

	it("returns 404 for non-existent deck", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(`/api/decks/${DECK_ID}/notes/${NOTE_ID}`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteResponse;
		expect(body.error?.code).toBe("DECK_NOT_FOUND");
	});

	it("returns 404 for non-existent note", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockNoteRepo.findByIdWithFieldValues).mockResolvedValue(
			undefined,
		);

		const res = await app.request(`/api/decks/${DECK_ID}/notes/${NOTE_ID}`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteResponse;
		expect(body.error?.code).toBe("NOTE_NOT_FOUND");
	});

	it("returns 400 for invalid note uuid", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/notes/invalid-id`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(`/api/decks/${DECK_ID}/notes/${NOTE_ID}`, {
			method: "GET",
		});

		expect(res.status).toBe(401);
	});
});

describe("PUT /api/decks/:deckId/notes/:noteId", () => {
	let app: Hono;
	let mockNoteRepo: ReturnType<typeof createMockNoteRepo>;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockNoteRepo = createMockNoteRepo();
		mockDeckRepo = createMockDeckRepo();
		const notesRouter = createNotesRouter({
			noteRepo: mockNoteRepo,
			deckRepo: mockDeckRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks/:deckId/notes", notesRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("updates note field values", async () => {
		const updatedNote: NoteWithFieldValues = {
			...createMockNote({ id: NOTE_ID, deckId: DECK_ID }),
			fieldValues: [
				createMockNoteFieldValue({
					noteId: NOTE_ID,
					noteFieldTypeId: FIELD_TYPE_ID,
					value: "Updated Front",
				}),
			],
		};

		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockNoteRepo.update).mockResolvedValue(updatedNote);

		const res = await app.request(`/api/decks/${DECK_ID}/notes/${NOTE_ID}`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				fields: { [FIELD_TYPE_ID]: "Updated Front" },
			}),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as NoteResponse;
		expect(body.note?.id).toBe(NOTE_ID);
		expect((body.note as NoteWithFieldValues)?.fieldValues?.[0]?.value).toBe(
			"Updated Front",
		);
		expect(mockNoteRepo.update).toHaveBeenCalledWith(NOTE_ID, DECK_ID, {
			[FIELD_TYPE_ID]: "Updated Front",
		});
	});

	it("returns 404 for non-existent deck", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(`/api/decks/${DECK_ID}/notes/${NOTE_ID}`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				fields: { [FIELD_TYPE_ID]: "Updated" },
			}),
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteResponse;
		expect(body.error?.code).toBe("DECK_NOT_FOUND");
	});

	it("returns 404 for non-existent note", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockNoteRepo.update).mockResolvedValue(undefined);

		const res = await app.request(`/api/decks/${DECK_ID}/notes/${NOTE_ID}`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				fields: { [FIELD_TYPE_ID]: "Updated" },
			}),
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteResponse;
		expect(body.error?.code).toBe("NOTE_NOT_FOUND");
	});

	it("returns 400 for missing fields", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/notes/${NOTE_ID}`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({}),
		});

		expect(res.status).toBe(400);
	});

	it("returns 400 for invalid note uuid", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/notes/invalid-id`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				fields: { [FIELD_TYPE_ID]: "Updated" },
			}),
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(`/api/decks/${DECK_ID}/notes/${NOTE_ID}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				fields: { [FIELD_TYPE_ID]: "Updated" },
			}),
		});

		expect(res.status).toBe(401);
	});
});

describe("DELETE /api/decks/:deckId/notes/:noteId", () => {
	let app: Hono;
	let mockNoteRepo: ReturnType<typeof createMockNoteRepo>;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockNoteRepo = createMockNoteRepo();
		mockDeckRepo = createMockDeckRepo();
		const notesRouter = createNotesRouter({
			noteRepo: mockNoteRepo,
			deckRepo: mockDeckRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks/:deckId/notes", notesRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("deletes note and its cards successfully", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockNoteRepo.softDelete).mockResolvedValue(true);

		const res = await app.request(`/api/decks/${DECK_ID}/notes/${NOTE_ID}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as NoteResponse;
		expect(body.success).toBe(true);
		expect(mockNoteRepo.softDelete).toHaveBeenCalledWith(NOTE_ID, DECK_ID);
	});

	it("returns 404 for non-existent deck", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(`/api/decks/${DECK_ID}/notes/${NOTE_ID}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteResponse;
		expect(body.error?.code).toBe("DECK_NOT_FOUND");
	});

	it("returns 404 for non-existent note", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockNoteRepo.softDelete).mockResolvedValue(false);

		const res = await app.request(`/api/decks/${DECK_ID}/notes/${NOTE_ID}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteResponse;
		expect(body.error?.code).toBe("NOTE_NOT_FOUND");
	});

	it("returns 400 for invalid note uuid", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/notes/invalid-id`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(`/api/decks/${DECK_ID}/notes/${NOTE_ID}`, {
			method: "DELETE",
		});

		expect(res.status).toBe(401);
	});
});
