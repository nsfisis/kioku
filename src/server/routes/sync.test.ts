import { Hono } from "hono";
import { sign } from "hono/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import type {
	SyncPullResult,
	SyncPushResult,
	SyncRepository,
} from "../repositories/sync.js";
import type {
	Card,
	Deck,
	Note,
	NoteFieldType,
	NoteFieldValue,
	NoteType,
	ReviewLog,
} from "../repositories/types.js";
import { createSyncRouter } from "./sync.js";

function createMockSyncRepo(): SyncRepository {
	return {
		pushChanges: vi.fn(),
		pullChanges: vi.fn(),
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

interface SyncPushResponse {
	decks?: { id: string; syncVersion: number }[];
	cards?: { id: string; syncVersion: number }[];
	reviewLogs?: { id: string; syncVersion: number }[];
	noteTypes?: { id: string; syncVersion: number }[];
	noteFieldTypes?: { id: string; syncVersion: number }[];
	notes?: { id: string; syncVersion: number }[];
	noteFieldValues?: { id: string; syncVersion: number }[];
	conflicts?: {
		decks: string[];
		cards: string[];
		noteTypes: string[];
		noteFieldTypes: string[];
		notes: string[];
		noteFieldValues: string[];
	};
	error?: {
		code: string;
		message: string;
	};
}

describe("POST /api/sync/push", () => {
	let app: Hono;
	let mockSyncRepo: ReturnType<typeof createMockSyncRepo>;
	let authToken: string;
	const userId = "user-uuid-123";

	beforeEach(async () => {
		vi.clearAllMocks();
		mockSyncRepo = createMockSyncRepo();
		const syncRouter = createSyncRouter({ syncRepo: mockSyncRepo });
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/sync", syncRouter);
		authToken = await createTestToken(userId);
	});

	it("returns 401 without authentication", async () => {
		const res = await app.request("/api/sync/push", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ decks: [], cards: [], reviewLogs: [] }),
		});

		expect(res.status).toBe(401);
	});

	it("successfully pushes empty data", async () => {
		const mockResult: SyncPushResult = {
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			conflicts: {
				decks: [],
				cards: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
			},
		};
		vi.mocked(mockSyncRepo.pushChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/push", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ decks: [], cards: [], reviewLogs: [] }),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPushResponse;
		expect(body.decks).toEqual([]);
		expect(body.cards).toEqual([]);
		expect(body.reviewLogs).toEqual([]);
		expect(body.noteTypes).toEqual([]);
		expect(body.noteFieldTypes).toEqual([]);
		expect(body.notes).toEqual([]);
		expect(body.noteFieldValues).toEqual([]);
		expect(mockSyncRepo.pushChanges).toHaveBeenCalledWith(userId, {
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
		});
	});

	it("successfully pushes decks", async () => {
		const deckData = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			name: "Test Deck",
			description: "A test deck",
			defaultNoteTypeId: null,
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-02T00:00:00.000Z",
			deletedAt: null,
		};

		const mockResult: SyncPushResult = {
			decks: [{ id: "deck-uuid-123", syncVersion: 1 }],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			conflicts: {
				decks: [],
				cards: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
			},
		};
		vi.mocked(mockSyncRepo.pushChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/push", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ decks: [deckData], cards: [], reviewLogs: [] }),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPushResponse;
		expect(body.decks).toHaveLength(1);
		expect(body.decks?.[0]?.id).toBe("deck-uuid-123");
		expect(body.decks?.[0]?.syncVersion).toBe(1);
	});

	it("successfully pushes cards", async () => {
		const cardData = {
			id: "550e8400-e29b-41d4-a716-446655440001",
			deckId: "550e8400-e29b-41d4-a716-446655440000",
			noteId: "550e8400-e29b-41d4-a716-446655440020",
			isReversed: false,
			front: "Question",
			back: "Answer",
			state: 0,
			due: "2024-01-01T00:00:00.000Z",
			stability: 0,
			difficulty: 0,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: 0,
			lapses: 0,
			lastReview: null,
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-02T00:00:00.000Z",
			deletedAt: null,
		};

		const mockResult: SyncPushResult = {
			decks: [],
			cards: [{ id: "550e8400-e29b-41d4-a716-446655440001", syncVersion: 1 }],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			conflicts: {
				decks: [],
				cards: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
			},
		};
		vi.mocked(mockSyncRepo.pushChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/push", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ decks: [], cards: [cardData], reviewLogs: [] }),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPushResponse;
		expect(body.cards).toHaveLength(1);
		expect(body.cards?.[0]?.id).toBe("550e8400-e29b-41d4-a716-446655440001");
	});

	it("successfully pushes review logs", async () => {
		const reviewLogData = {
			id: "550e8400-e29b-41d4-a716-446655440002",
			cardId: "550e8400-e29b-41d4-a716-446655440001",
			rating: 3,
			state: 0,
			scheduledDays: 1,
			elapsedDays: 0,
			reviewedAt: "2024-01-01T00:00:00.000Z",
			durationMs: 5000,
		};

		const mockResult: SyncPushResult = {
			decks: [],
			cards: [],
			reviewLogs: [
				{ id: "550e8400-e29b-41d4-a716-446655440002", syncVersion: 1 },
			],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			conflicts: {
				decks: [],
				cards: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
			},
		};
		vi.mocked(mockSyncRepo.pushChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/push", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				decks: [],
				cards: [],
				reviewLogs: [reviewLogData],
			}),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPushResponse;
		expect(body.reviewLogs).toHaveLength(1);
		expect(body.reviewLogs?.[0]?.id).toBe(
			"550e8400-e29b-41d4-a716-446655440002",
		);
	});

	it("returns conflicts when server data is newer", async () => {
		const deckData = {
			id: "550e8400-e29b-41d4-a716-446655440003",
			name: "Test Deck",
			description: null,
			defaultNoteTypeId: null,
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-02T00:00:00.000Z",
			deletedAt: null,
		};

		const mockResult: SyncPushResult = {
			decks: [{ id: "550e8400-e29b-41d4-a716-446655440003", syncVersion: 5 }],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			conflicts: {
				decks: ["550e8400-e29b-41d4-a716-446655440003"],
				cards: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
			},
		};
		vi.mocked(mockSyncRepo.pushChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/push", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ decks: [deckData], cards: [], reviewLogs: [] }),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPushResponse;
		expect(body.conflicts?.decks).toContain(
			"550e8400-e29b-41d4-a716-446655440003",
		);
	});

	it("validates deck schema", async () => {
		const invalidDeck = {
			id: "not-a-uuid",
			name: "",
			description: null,
			createdAt: "invalid-date",
			updatedAt: "2024-01-01T00:00:00.000Z",
			deletedAt: null,
		};

		const res = await app.request("/api/sync/push", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ decks: [invalidDeck], cards: [], reviewLogs: [] }),
		});

		expect(res.status).toBe(400);
	});

	it("validates card schema", async () => {
		const invalidCard = {
			id: "card-uuid-123",
			deckId: "not-a-uuid",
			front: "",
			back: "Answer",
			state: 5, // Invalid state
			due: "2024-01-01T00:00:00.000Z",
			stability: -1, // Invalid
			difficulty: 0,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: 0,
			lapses: 0,
			lastReview: null,
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
			deletedAt: null,
		};

		const res = await app.request("/api/sync/push", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ decks: [], cards: [invalidCard], reviewLogs: [] }),
		});

		expect(res.status).toBe(400);
	});

	it("validates review log schema", async () => {
		const invalidLog = {
			id: "log-uuid-123",
			cardId: "card-uuid-123",
			rating: 5, // Invalid rating (must be 1-4)
			state: 0,
			scheduledDays: 1,
			elapsedDays: 0,
			reviewedAt: "2024-01-01T00:00:00.000Z",
			durationMs: 5000,
		};

		const res = await app.request("/api/sync/push", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				decks: [],
				cards: [],
				reviewLogs: [invalidLog],
			}),
		});

		expect(res.status).toBe(400);
	});

	it("pushes multiple entities at once", async () => {
		const deckData = {
			id: "550e8400-e29b-41d4-a716-446655440004",
			name: "Test Deck",
			description: null,
			defaultNoteTypeId: null,
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
			deletedAt: null,
		};

		const cardData = {
			id: "550e8400-e29b-41d4-a716-446655440005",
			deckId: "550e8400-e29b-41d4-a716-446655440004",
			noteId: "550e8400-e29b-41d4-a716-446655440020",
			isReversed: false,
			front: "Q",
			back: "A",
			state: 0,
			due: "2024-01-01T00:00:00.000Z",
			stability: 0,
			difficulty: 0,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: 0,
			lapses: 0,
			lastReview: null,
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
			deletedAt: null,
		};

		const reviewLogData = {
			id: "550e8400-e29b-41d4-a716-446655440006",
			cardId: "550e8400-e29b-41d4-a716-446655440005",
			rating: 3,
			state: 0,
			scheduledDays: 1,
			elapsedDays: 0,
			reviewedAt: "2024-01-01T00:00:00.000Z",
			durationMs: null,
		};

		const mockResult: SyncPushResult = {
			decks: [{ id: "550e8400-e29b-41d4-a716-446655440004", syncVersion: 1 }],
			cards: [{ id: "550e8400-e29b-41d4-a716-446655440005", syncVersion: 1 }],
			reviewLogs: [
				{ id: "550e8400-e29b-41d4-a716-446655440006", syncVersion: 1 },
			],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			conflicts: {
				decks: [],
				cards: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
			},
		};
		vi.mocked(mockSyncRepo.pushChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/push", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				decks: [deckData],
				cards: [cardData],
				reviewLogs: [reviewLogData],
			}),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPushResponse;
		expect(body.decks).toHaveLength(1);
		expect(body.cards).toHaveLength(1);
		expect(body.reviewLogs).toHaveLength(1);
	});

	it("successfully pushes note types", async () => {
		const noteTypeData = {
			id: "550e8400-e29b-41d4-a716-446655440010",
			name: "Basic Note",
			frontTemplate: "{{Front}}",
			backTemplate: "{{Back}}",
			isReversible: false,
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-02T00:00:00.000Z",
			deletedAt: null,
		};

		const mockResult: SyncPushResult = {
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [
				{ id: "550e8400-e29b-41d4-a716-446655440010", syncVersion: 1 },
			],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			conflicts: {
				decks: [],
				cards: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
			},
		};
		vi.mocked(mockSyncRepo.pushChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/push", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [noteTypeData],
			}),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPushResponse;
		expect(body.noteTypes).toHaveLength(1);
		expect(body.noteTypes?.[0]?.id).toBe(
			"550e8400-e29b-41d4-a716-446655440010",
		);
	});

	it("successfully pushes cards with noteId and isReversed", async () => {
		const cardData = {
			id: "550e8400-e29b-41d4-a716-446655440011",
			deckId: "550e8400-e29b-41d4-a716-446655440000",
			noteId: "550e8400-e29b-41d4-a716-446655440020",
			isReversed: true,
			front: "Question",
			back: "Answer",
			state: 0,
			due: "2024-01-01T00:00:00.000Z",
			stability: 0,
			difficulty: 0,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: 0,
			lapses: 0,
			lastReview: null,
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-02T00:00:00.000Z",
			deletedAt: null,
		};

		const mockResult: SyncPushResult = {
			decks: [],
			cards: [{ id: "550e8400-e29b-41d4-a716-446655440011", syncVersion: 1 }],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			conflicts: {
				decks: [],
				cards: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
			},
		};
		vi.mocked(mockSyncRepo.pushChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/push", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				decks: [],
				cards: [cardData],
				reviewLogs: [],
			}),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPushResponse;
		expect(body.cards).toHaveLength(1);
		expect(body.cards?.[0]?.id).toBe("550e8400-e29b-41d4-a716-446655440011");
	});

	it("handles soft-deleted entities", async () => {
		const deletedDeck = {
			id: "550e8400-e29b-41d4-a716-446655440007",
			name: "Deleted Deck",
			description: null,
			defaultNoteTypeId: null,
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-02T00:00:00.000Z",
			deletedAt: "2024-01-02T00:00:00.000Z",
		};

		const mockResult: SyncPushResult = {
			decks: [{ id: "550e8400-e29b-41d4-a716-446655440007", syncVersion: 2 }],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			conflicts: {
				decks: [],
				cards: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
			},
		};
		vi.mocked(mockSyncRepo.pushChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/push", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				decks: [deletedDeck],
				cards: [],
				reviewLogs: [],
			}),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPushResponse;
		expect(body.decks).toHaveLength(1);
	});

	it("successfully pushes CRDT changes", async () => {
		const crdtChange = {
			documentId: "deck:550e8400-e29b-41d4-a716-446655440000",
			entityType: "deck" as const,
			entityId: "550e8400-e29b-41d4-a716-446655440000",
			binary: "SGVsbG8gV29ybGQ=", // Base64 encoded test data
		};

		const mockResult: SyncPushResult = {
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [
				{
					entityType: "deck",
					entityId: "550e8400-e29b-41d4-a716-446655440000",
					syncVersion: 1,
				},
			],
			conflicts: {
				decks: [],
				cards: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
			},
		};
		vi.mocked(mockSyncRepo.pushChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/push", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				decks: [],
				cards: [],
				reviewLogs: [],
				crdtChanges: [crdtChange],
			}),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as { crdtChanges?: unknown[] };
		expect(body.crdtChanges).toHaveLength(1);
		expect(mockSyncRepo.pushChanges).toHaveBeenCalledWith(
			userId,
			expect.objectContaining({
				crdtChanges: [crdtChange],
			}),
		);
	});

	it("validates CRDT changes have required fields", async () => {
		const invalidCrdtChange = {
			documentId: "deck:123",
			entityType: "deck",
			// missing entityId and binary
		};

		const res = await app.request("/api/sync/push", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				decks: [],
				cards: [],
				reviewLogs: [],
				crdtChanges: [invalidCrdtChange],
			}),
		});

		expect(res.status).toBe(400);
	});

	it("validates CRDT entity type is valid", async () => {
		const invalidCrdtChange = {
			documentId: "invalid:550e8400-e29b-41d4-a716-446655440000",
			entityType: "invalidType",
			entityId: "550e8400-e29b-41d4-a716-446655440000",
			binary: "SGVsbG8gV29ybGQ=",
		};

		const res = await app.request("/api/sync/push", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				decks: [],
				cards: [],
				reviewLogs: [],
				crdtChanges: [invalidCrdtChange],
			}),
		});

		expect(res.status).toBe(400);
	});
});

interface SyncPullResponse {
	decks?: Deck[];
	cards?: Card[];
	reviewLogs?: ReviewLog[];
	noteTypes?: NoteType[];
	noteFieldTypes?: NoteFieldType[];
	notes?: Note[];
	noteFieldValues?: NoteFieldValue[];
	currentSyncVersion?: number;
	error?: {
		code: string;
		message: string;
	};
}

describe("GET /api/sync/pull", () => {
	let app: Hono;
	let mockSyncRepo: ReturnType<typeof createMockSyncRepo>;
	let authToken: string;
	const userId = "user-uuid-123";

	beforeEach(async () => {
		vi.clearAllMocks();
		mockSyncRepo = createMockSyncRepo();
		const syncRouter = createSyncRouter({ syncRepo: mockSyncRepo });
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/sync", syncRouter);
		authToken = await createTestToken(userId);
	});

	it("returns 401 without authentication", async () => {
		const res = await app.request("/api/sync/pull");

		expect(res.status).toBe(401);
	});

	it("successfully pulls with default lastSyncVersion (0)", async () => {
		const mockDeck: Deck = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			userId,
			name: "Test Deck",
			description: null,
			defaultNoteTypeId: null,
			createdAt: new Date("2024-01-01T00:00:00.000Z"),
			updatedAt: new Date("2024-01-02T00:00:00.000Z"),
			deletedAt: null,
			syncVersion: 1,
		};

		const mockResult: SyncPullResult = {
			decks: [mockDeck],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			currentSyncVersion: 1,
		};
		vi.mocked(mockSyncRepo.pullChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/pull", {
			headers: {
				Authorization: `Bearer ${authToken}`,
			},
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPullResponse;
		expect(body.decks).toHaveLength(1);
		expect(body.cards).toHaveLength(0);
		expect(body.reviewLogs).toHaveLength(0);
		expect(body.noteTypes).toHaveLength(0);
		expect(body.noteFieldTypes).toHaveLength(0);
		expect(body.notes).toHaveLength(0);
		expect(body.noteFieldValues).toHaveLength(0);
		expect(body.currentSyncVersion).toBe(1);
		expect(mockSyncRepo.pullChanges).toHaveBeenCalledWith(userId, {
			lastSyncVersion: 0,
		});
	});

	it("successfully pulls with specified lastSyncVersion", async () => {
		const mockResult: SyncPullResult = {
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			currentSyncVersion: 5,
		};
		vi.mocked(mockSyncRepo.pullChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/pull?lastSyncVersion=5", {
			headers: {
				Authorization: `Bearer ${authToken}`,
			},
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPullResponse;
		expect(body.decks).toEqual([]);
		expect(body.currentSyncVersion).toBe(5);
		expect(mockSyncRepo.pullChanges).toHaveBeenCalledWith(userId, {
			lastSyncVersion: 5,
		});
	});

	it("returns decks with proper fields", async () => {
		const mockDeck: Deck = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			userId,
			name: "Test Deck",
			description: "A test description",
			defaultNoteTypeId: null,
			createdAt: new Date("2024-01-01T00:00:00.000Z"),
			updatedAt: new Date("2024-01-02T00:00:00.000Z"),
			deletedAt: null,
			syncVersion: 2,
		};

		const mockResult: SyncPullResult = {
			decks: [mockDeck],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			currentSyncVersion: 2,
		};
		vi.mocked(mockSyncRepo.pullChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/pull?lastSyncVersion=1", {
			headers: {
				Authorization: `Bearer ${authToken}`,
			},
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPullResponse;
		expect(body.decks?.[0]?.id).toBe("550e8400-e29b-41d4-a716-446655440000");
		expect(body.decks?.[0]?.name).toBe("Test Deck");
		expect(body.decks?.[0]?.description).toBe("A test description");
		expect(body.decks?.[0]?.syncVersion).toBe(2);
	});

	it("returns cards with FSRS fields", async () => {
		const mockCard: Card = {
			id: "550e8400-e29b-41d4-a716-446655440001",
			deckId: "550e8400-e29b-41d4-a716-446655440000",
			noteId: "550e8400-e29b-41d4-a716-446655440020",
			isReversed: false,
			front: "Question",
			back: "Answer",
			state: 2,
			due: new Date("2024-01-05T00:00:00.000Z"),
			stability: 5.5,
			difficulty: 0.3,
			elapsedDays: 3,
			scheduledDays: 4,
			reps: 2,
			lapses: 0,
			lastReview: new Date("2024-01-02T00:00:00.000Z"),
			createdAt: new Date("2024-01-01T00:00:00.000Z"),
			updatedAt: new Date("2024-01-02T00:00:00.000Z"),
			deletedAt: null,
			syncVersion: 3,
		};

		const mockResult: SyncPullResult = {
			decks: [],
			cards: [mockCard],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			currentSyncVersion: 3,
		};
		vi.mocked(mockSyncRepo.pullChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/pull?lastSyncVersion=2", {
			headers: {
				Authorization: `Bearer ${authToken}`,
			},
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPullResponse;
		expect(body.cards).toHaveLength(1);
		expect(body.cards?.[0]?.id).toBe("550e8400-e29b-41d4-a716-446655440001");
		expect(body.cards?.[0]?.state).toBe(2);
		expect(body.cards?.[0]?.stability).toBe(5.5);
		expect(body.cards?.[0]?.difficulty).toBe(0.3);
		expect(body.cards?.[0]?.reps).toBe(2);
	});

	it("returns review logs", async () => {
		const mockReviewLog: ReviewLog = {
			id: "550e8400-e29b-41d4-a716-446655440002",
			cardId: "550e8400-e29b-41d4-a716-446655440001",
			userId,
			rating: 3,
			state: 2,
			scheduledDays: 4,
			elapsedDays: 3,
			reviewedAt: new Date("2024-01-02T00:00:00.000Z"),
			durationMs: 5000,
			syncVersion: 1,
		};

		const mockResult: SyncPullResult = {
			decks: [],
			cards: [],
			reviewLogs: [mockReviewLog],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			currentSyncVersion: 1,
		};
		vi.mocked(mockSyncRepo.pullChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/pull", {
			headers: {
				Authorization: `Bearer ${authToken}`,
			},
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPullResponse;
		expect(body.reviewLogs).toHaveLength(1);
		expect(body.reviewLogs?.[0]?.id).toBe(
			"550e8400-e29b-41d4-a716-446655440002",
		);
		expect(body.reviewLogs?.[0]?.rating).toBe(3);
		expect(body.reviewLogs?.[0]?.durationMs).toBe(5000);
	});

	it("returns multiple entities", async () => {
		const mockDeck: Deck = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			userId,
			name: "Test Deck",
			description: null,
			defaultNoteTypeId: null,
			createdAt: new Date("2024-01-01T00:00:00.000Z"),
			updatedAt: new Date("2024-01-01T00:00:00.000Z"),
			deletedAt: null,
			syncVersion: 1,
		};

		const mockCard: Card = {
			id: "550e8400-e29b-41d4-a716-446655440001",
			deckId: "550e8400-e29b-41d4-a716-446655440000",
			noteId: "550e8400-e29b-41d4-a716-446655440020",
			isReversed: false,
			front: "Q",
			back: "A",
			state: 0,
			due: new Date("2024-01-01T00:00:00.000Z"),
			stability: 0,
			difficulty: 0,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: 0,
			lapses: 0,
			lastReview: null,
			createdAt: new Date("2024-01-01T00:00:00.000Z"),
			updatedAt: new Date("2024-01-01T00:00:00.000Z"),
			deletedAt: null,
			syncVersion: 2,
		};

		const mockReviewLog: ReviewLog = {
			id: "550e8400-e29b-41d4-a716-446655440002",
			cardId: "550e8400-e29b-41d4-a716-446655440001",
			userId,
			rating: 3,
			state: 0,
			scheduledDays: 1,
			elapsedDays: 0,
			reviewedAt: new Date("2024-01-01T00:00:00.000Z"),
			durationMs: null,
			syncVersion: 3,
		};

		const mockResult: SyncPullResult = {
			decks: [mockDeck],
			cards: [mockCard],
			reviewLogs: [mockReviewLog],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			currentSyncVersion: 3,
		};
		vi.mocked(mockSyncRepo.pullChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/pull", {
			headers: {
				Authorization: `Bearer ${authToken}`,
			},
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPullResponse;
		expect(body.decks).toHaveLength(1);
		expect(body.cards).toHaveLength(1);
		expect(body.reviewLogs).toHaveLength(1);
		expect(body.noteTypes).toHaveLength(0);
		expect(body.noteFieldTypes).toHaveLength(0);
		expect(body.notes).toHaveLength(0);
		expect(body.noteFieldValues).toHaveLength(0);
		expect(body.currentSyncVersion).toBe(3);
	});

	it("returns note types", async () => {
		const mockNoteType: NoteType = {
			id: "550e8400-e29b-41d4-a716-446655440010",
			userId,
			name: "Basic Note",
			frontTemplate: "{{Front}}",
			backTemplate: "{{Back}}",
			isReversible: false,
			createdAt: new Date("2024-01-01T00:00:00.000Z"),
			updatedAt: new Date("2024-01-02T00:00:00.000Z"),
			deletedAt: null,
			syncVersion: 1,
		};

		const mockResult: SyncPullResult = {
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [mockNoteType],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			currentSyncVersion: 1,
		};
		vi.mocked(mockSyncRepo.pullChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/pull", {
			headers: {
				Authorization: `Bearer ${authToken}`,
			},
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPullResponse;
		expect(body.noteTypes).toHaveLength(1);
		expect(body.noteTypes?.[0]?.id).toBe(
			"550e8400-e29b-41d4-a716-446655440010",
		);
		expect(body.noteTypes?.[0]?.name).toBe("Basic Note");
		expect(body.noteTypes?.[0]?.frontTemplate).toBe("{{Front}}");
		expect(body.noteTypes?.[0]?.isReversible).toBe(false);
	});

	it("returns cards with noteId and isReversed fields", async () => {
		const mockCard: Card = {
			id: "550e8400-e29b-41d4-a716-446655440001",
			deckId: "550e8400-e29b-41d4-a716-446655440000",
			noteId: "550e8400-e29b-41d4-a716-446655440020",
			isReversed: true,
			front: "Question",
			back: "Answer",
			state: 0,
			due: new Date("2024-01-01T00:00:00.000Z"),
			stability: 0,
			difficulty: 0,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: 0,
			lapses: 0,
			lastReview: null,
			createdAt: new Date("2024-01-01T00:00:00.000Z"),
			updatedAt: new Date("2024-01-02T00:00:00.000Z"),
			deletedAt: null,
			syncVersion: 1,
		};

		const mockResult: SyncPullResult = {
			decks: [],
			cards: [mockCard],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			currentSyncVersion: 1,
		};
		vi.mocked(mockSyncRepo.pullChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/pull", {
			headers: {
				Authorization: `Bearer ${authToken}`,
			},
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPullResponse;
		expect(body.cards).toHaveLength(1);
		expect(body.cards?.[0]?.noteId).toBe(
			"550e8400-e29b-41d4-a716-446655440020",
		);
		expect(body.cards?.[0]?.isReversed).toBe(true);
	});

	it("returns soft-deleted entities", async () => {
		const deletedDeck: Deck = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			userId,
			name: "Deleted Deck",
			description: null,
			defaultNoteTypeId: null,
			createdAt: new Date("2024-01-01T00:00:00.000Z"),
			updatedAt: new Date("2024-01-02T00:00:00.000Z"),
			deletedAt: new Date("2024-01-02T00:00:00.000Z"),
			syncVersion: 2,
		};

		const mockResult: SyncPullResult = {
			decks: [deletedDeck],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [],
			currentSyncVersion: 2,
		};
		vi.mocked(mockSyncRepo.pullChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/pull?lastSyncVersion=1", {
			headers: {
				Authorization: `Bearer ${authToken}`,
			},
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as SyncPullResponse;
		expect(body.decks).toHaveLength(1);
		expect(body.decks?.[0]?.deletedAt).not.toBeNull();
	});

	it("validates lastSyncVersion is non-negative", async () => {
		const res = await app.request("/api/sync/pull?lastSyncVersion=-1", {
			headers: {
				Authorization: `Bearer ${authToken}`,
			},
		});

		expect(res.status).toBe(400);
	});

	it("returns CRDT changes in pull response", async () => {
		const mockResult: SyncPullResult = {
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			crdtChanges: [
				{
					documentId: "deck:550e8400-e29b-41d4-a716-446655440000",
					entityType: "deck",
					entityId: "550e8400-e29b-41d4-a716-446655440000",
					binary: "SGVsbG8gV29ybGQ=",
				},
			],
			currentSyncVersion: 1,
		};
		vi.mocked(mockSyncRepo.pullChanges).mockResolvedValue(mockResult);

		const res = await app.request("/api/sync/pull", {
			headers: {
				Authorization: `Bearer ${authToken}`,
			},
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as { crdtChanges?: unknown[] };
		expect(body.crdtChanges).toHaveLength(1);
	});
});
