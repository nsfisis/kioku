import { Hono } from "hono";
import { sign } from "hono/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import type {
	SyncPushData,
	SyncPushResult,
	SyncRepository,
} from "../repositories/sync.js";
import { createSyncRouter } from "./sync.js";

function createMockSyncRepo(): SyncRepository {
	return {
		pushChanges: vi.fn(),
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
	conflicts?: {
		decks: string[];
		cards: string[];
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
			conflicts: { decks: [], cards: [] },
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
		expect(body.conflicts).toEqual({ decks: [], cards: [] });
		expect(mockSyncRepo.pushChanges).toHaveBeenCalledWith(userId, {
			decks: [],
			cards: [],
			reviewLogs: [],
		});
	});

	it("successfully pushes decks", async () => {
		const deckData = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			name: "Test Deck",
			description: "A test deck",
			newCardsPerDay: 20,
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-02T00:00:00.000Z",
			deletedAt: null,
		};

		const mockResult: SyncPushResult = {
			decks: [{ id: "deck-uuid-123", syncVersion: 1 }],
			cards: [],
			reviewLogs: [],
			conflicts: { decks: [], cards: [] },
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
			conflicts: { decks: [], cards: [] },
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
			reviewLogs: [{ id: "550e8400-e29b-41d4-a716-446655440002", syncVersion: 1 }],
			conflicts: { decks: [], cards: [] },
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
		expect(body.reviewLogs?.[0]?.id).toBe("550e8400-e29b-41d4-a716-446655440002");
	});

	it("returns conflicts when server data is newer", async () => {
		const deckData = {
			id: "550e8400-e29b-41d4-a716-446655440003",
			name: "Test Deck",
			description: null,
			newCardsPerDay: 20,
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-02T00:00:00.000Z",
			deletedAt: null,
		};

		const mockResult: SyncPushResult = {
			decks: [{ id: "550e8400-e29b-41d4-a716-446655440003", syncVersion: 5 }],
			cards: [],
			reviewLogs: [],
			conflicts: { decks: ["550e8400-e29b-41d4-a716-446655440003"], cards: [] },
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
		expect(body.conflicts?.decks).toContain("550e8400-e29b-41d4-a716-446655440003");
	});

	it("validates deck schema", async () => {
		const invalidDeck = {
			id: "not-a-uuid",
			name: "",
			description: null,
			newCardsPerDay: -1,
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
			newCardsPerDay: 20,
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-01T00:00:00.000Z",
			deletedAt: null,
		};

		const cardData = {
			id: "550e8400-e29b-41d4-a716-446655440005",
			deckId: "550e8400-e29b-41d4-a716-446655440004",
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
			reviewLogs: [{ id: "550e8400-e29b-41d4-a716-446655440006", syncVersion: 1 }],
			conflicts: { decks: [], cards: [] },
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

	it("handles soft-deleted entities", async () => {
		const deletedDeck = {
			id: "550e8400-e29b-41d4-a716-446655440007",
			name: "Deleted Deck",
			description: null,
			newCardsPerDay: 20,
			createdAt: "2024-01-01T00:00:00.000Z",
			updatedAt: "2024-01-02T00:00:00.000Z",
			deletedAt: "2024-01-02T00:00:00.000Z",
		};

		const mockResult: SyncPushResult = {
			decks: [{ id: "550e8400-e29b-41d4-a716-446655440007", syncVersion: 2 }],
			cards: [],
			reviewLogs: [],
			conflicts: { decks: [], cards: [] },
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
});
