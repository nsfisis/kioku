import { Hono } from "hono";
import { sign } from "hono/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import type {
	CardRepository,
	Deck,
	DeckRepository,
} from "../repositories/index.js";
import { createDecksRouter } from "./decks.js";

function createMockDeckRepo(): DeckRepository {
	return {
		findByUserId: vi.fn(),
		findById: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		softDelete: vi.fn(),
	};
}

function createMockCardRepo(): CardRepository {
	return {
		findByDeckId: vi.fn(),
		findById: vi.fn(),
		findByIdWithNoteData: vi.fn(),
		findByNoteId: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		softDelete: vi.fn(),
		softDeleteByNoteId: vi.fn(),
		findDueCards: vi.fn(),
		countDueCards: vi.fn().mockResolvedValue(0),
		countNewCards: vi.fn().mockResolvedValue(0),
		findDueCardsWithNoteData: vi.fn(),
		findDueCardsForStudy: vi.fn(),
		updateFSRSFields: vi.fn(),
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
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		deletedAt: null,
		syncVersion: 0,
		...overrides,
	};
}

interface DeckResponse {
	deck?: Deck;
	decks?: Deck[];
	success?: boolean;
	error?: {
		code: string;
		message: string;
	};
}

describe("GET /api/decks", () => {
	let app: Hono;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let mockCardRepo: ReturnType<typeof createMockCardRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockDeckRepo = createMockDeckRepo();
		mockCardRepo = createMockCardRepo();
		const decksRouter = createDecksRouter({
			deckRepo: mockDeckRepo,
			cardRepo: mockCardRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks", decksRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("returns empty array when user has no decks", async () => {
		vi.mocked(mockDeckRepo.findByUserId).mockResolvedValue([]);

		const res = await app.request("/api/decks", {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as DeckResponse;
		expect(body.decks).toEqual([]);
		expect(mockDeckRepo.findByUserId).toHaveBeenCalledWith("user-uuid-123");
	});

	it("returns user decks", async () => {
		const mockDecks = [
			createMockDeck({ id: "deck-1", name: "Deck 1" }),
			createMockDeck({ id: "deck-2", name: "Deck 2" }),
		];
		vi.mocked(mockDeckRepo.findByUserId).mockResolvedValue(mockDecks);

		const res = await app.request("/api/decks", {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as DeckResponse;
		expect(body.decks).toHaveLength(2);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request("/api/decks", {
			method: "GET",
		});

		expect(res.status).toBe(401);
	});
});

describe("POST /api/decks", () => {
	let app: Hono;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let mockCardRepo: ReturnType<typeof createMockCardRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockDeckRepo = createMockDeckRepo();
		mockCardRepo = createMockCardRepo();
		const decksRouter = createDecksRouter({
			deckRepo: mockDeckRepo,
			cardRepo: mockCardRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks", decksRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("creates a new deck with required fields", async () => {
		const newDeck = createMockDeck({ name: "New Deck" });
		vi.mocked(mockDeckRepo.create).mockResolvedValue(newDeck);

		const res = await app.request("/api/decks", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: "New Deck" }),
		});

		expect(res.status).toBe(201);
		const body = (await res.json()) as DeckResponse;
		expect(body.deck?.name).toBe("New Deck");
		expect(mockDeckRepo.create).toHaveBeenCalledWith({
			userId: "user-uuid-123",
			name: "New Deck",
			description: undefined,
		});
	});

	it("creates a new deck with all fields", async () => {
		const newDeck = createMockDeck({
			name: "Full Deck",
			description: "Full description",
		});
		vi.mocked(mockDeckRepo.create).mockResolvedValue(newDeck);

		const res = await app.request("/api/decks", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name: "Full Deck",
				description: "Full description",
			}),
		});

		expect(res.status).toBe(201);
		const body = (await res.json()) as DeckResponse;
		expect(body.deck?.name).toBe("Full Deck");
		expect(mockDeckRepo.create).toHaveBeenCalledWith({
			userId: "user-uuid-123",
			name: "Full Deck",
			description: "Full description",
		});
	});

	it("returns 400 for missing name", async () => {
		const res = await app.request("/api/decks", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({}),
		});

		expect(res.status).toBe(400);
	});

	it("returns 400 for empty name", async () => {
		const res = await app.request("/api/decks", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: "" }),
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request("/api/decks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Test" }),
		});

		expect(res.status).toBe(401);
	});
});

describe("GET /api/decks/:id", () => {
	let app: Hono;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let mockCardRepo: ReturnType<typeof createMockCardRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockDeckRepo = createMockDeckRepo();
		mockCardRepo = createMockCardRepo();
		const decksRouter = createDecksRouter({
			deckRepo: mockDeckRepo,
			cardRepo: mockCardRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks", decksRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("returns deck by id", async () => {
		const deckId = "a0000000-0000-4000-8000-000000000001";
		const mockDeck = createMockDeck({ id: deckId });
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(mockDeck);

		const res = await app.request(`/api/decks/${deckId}`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as DeckResponse;
		expect(body.deck?.id).toBe(deckId);
		expect(mockDeckRepo.findById).toHaveBeenCalledWith(deckId, "user-uuid-123");
	});

	it("returns 404 for non-existent deck", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(
			"/api/decks/00000000-0000-0000-0000-000000000000",
			{
				method: "GET",
				headers: { Authorization: `Bearer ${authToken}` },
			},
		);

		expect(res.status).toBe(404);
		const body = (await res.json()) as DeckResponse;
		expect(body.error?.code).toBe("DECK_NOT_FOUND");
	});

	it("returns 400 for invalid uuid", async () => {
		const res = await app.request("/api/decks/invalid-id", {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request("/api/decks/deck-uuid-123", {
			method: "GET",
		});

		expect(res.status).toBe(401);
	});
});

describe("PUT /api/decks/:id", () => {
	let app: Hono;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let mockCardRepo: ReturnType<typeof createMockCardRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockDeckRepo = createMockDeckRepo();
		mockCardRepo = createMockCardRepo();
		const decksRouter = createDecksRouter({
			deckRepo: mockDeckRepo,
			cardRepo: mockCardRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks", decksRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("updates deck name", async () => {
		const updatedDeck = createMockDeck({ name: "Updated Name" });
		vi.mocked(mockDeckRepo.update).mockResolvedValue(updatedDeck);

		const res = await app.request(
			"/api/decks/00000000-0000-0000-0000-000000000000",
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name: "Updated Name" }),
			},
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as DeckResponse;
		expect(body.deck?.name).toBe("Updated Name");
	});

	it("updates deck description", async () => {
		const updatedDeck = createMockDeck({ description: "New description" });
		vi.mocked(mockDeckRepo.update).mockResolvedValue(updatedDeck);

		const res = await app.request(
			"/api/decks/00000000-0000-0000-0000-000000000000",
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ description: "New description" }),
			},
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as DeckResponse;
		expect(body.deck?.description).toBe("New description");
	});

	it("returns 404 for non-existent deck", async () => {
		vi.mocked(mockDeckRepo.update).mockResolvedValue(undefined);

		const res = await app.request(
			"/api/decks/00000000-0000-0000-0000-000000000000",
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name: "Test" }),
			},
		);

		expect(res.status).toBe(404);
		const body = (await res.json()) as DeckResponse;
		expect(body.error?.code).toBe("DECK_NOT_FOUND");
	});

	it("returns 400 for invalid uuid", async () => {
		const res = await app.request("/api/decks/invalid-id", {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: "Test" }),
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(
			"/api/decks/00000000-0000-0000-0000-000000000000",
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Test" }),
			},
		);

		expect(res.status).toBe(401);
	});
});

describe("DELETE /api/decks/:id", () => {
	let app: Hono;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let mockCardRepo: ReturnType<typeof createMockCardRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockDeckRepo = createMockDeckRepo();
		mockCardRepo = createMockCardRepo();
		const decksRouter = createDecksRouter({
			deckRepo: mockDeckRepo,
			cardRepo: mockCardRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks", decksRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("deletes deck successfully", async () => {
		vi.mocked(mockDeckRepo.softDelete).mockResolvedValue(true);

		const res = await app.request(
			"/api/decks/00000000-0000-0000-0000-000000000000",
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${authToken}` },
			},
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as DeckResponse;
		expect(body.success).toBe(true);
		expect(mockDeckRepo.softDelete).toHaveBeenCalledWith(
			"00000000-0000-0000-0000-000000000000",
			"user-uuid-123",
		);
	});

	it("returns 404 for non-existent deck", async () => {
		vi.mocked(mockDeckRepo.softDelete).mockResolvedValue(false);

		const res = await app.request(
			"/api/decks/00000000-0000-0000-0000-000000000000",
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${authToken}` },
			},
		);

		expect(res.status).toBe(404);
		const body = (await res.json()) as DeckResponse;
		expect(body.error?.code).toBe("DECK_NOT_FOUND");
	});

	it("returns 400 for invalid uuid", async () => {
		const res = await app.request("/api/decks/invalid-id", {
			method: "DELETE",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(
			"/api/decks/00000000-0000-0000-0000-000000000000",
			{
				method: "DELETE",
			},
		);

		expect(res.status).toBe(401);
	});
});
