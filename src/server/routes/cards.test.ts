import { Hono } from "hono";
import { sign } from "hono/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardState } from "../db/schema.js";
import { errorHandler } from "../middleware/index.js";
import type {
	Card,
	CardRepository,
	Deck,
	DeckRepository,
} from "../repositories/index.js";
import { createCardsRouter } from "./cards.js";

function createMockCardRepo(): CardRepository {
	return {
		findByDeckId: vi.fn(),
		findById: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		softDelete: vi.fn(),
		findDueCards: vi.fn(),
		updateFSRSFields: vi.fn(),
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

function createMockCard(overrides: Partial<Card> = {}): Card {
	return {
		id: "card-uuid-123",
		deckId: "deck-uuid-123",
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

interface CardResponse {
	card?: Card;
	cards?: Card[];
	success?: boolean;
	error?: {
		code: string;
		message: string;
	};
}

const DECK_ID = "00000000-0000-4000-8000-000000000001";
const CARD_ID = "00000000-0000-4000-8000-000000000002";

describe("GET /api/decks/:deckId/cards", () => {
	let app: Hono;
	let mockCardRepo: ReturnType<typeof createMockCardRepo>;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockCardRepo = createMockCardRepo();
		mockDeckRepo = createMockDeckRepo();
		const cardsRouter = createCardsRouter({
			cardRepo: mockCardRepo,
			deckRepo: mockDeckRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks/:deckId/cards", cardsRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("returns empty array when deck has no cards", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.findByDeckId).mockResolvedValue([]);

		const res = await app.request(`/api/decks/${DECK_ID}/cards`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as CardResponse;
		expect(body.cards).toEqual([]);
		expect(mockDeckRepo.findById).toHaveBeenCalledWith(
			DECK_ID,
			"user-uuid-123",
		);
		expect(mockCardRepo.findByDeckId).toHaveBeenCalledWith(DECK_ID);
	});

	it("returns cards for deck", async () => {
		const mockCards = [
			createMockCard({ id: "card-1", front: "Q1", back: "A1" }),
			createMockCard({ id: "card-2", front: "Q2", back: "A2" }),
		];
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.findByDeckId).mockResolvedValue(mockCards);

		const res = await app.request(`/api/decks/${DECK_ID}/cards`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as CardResponse;
		expect(body.cards).toHaveLength(2);
	});

	it("returns 404 for non-existent deck", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(`/api/decks/${DECK_ID}/cards`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as CardResponse;
		expect(body.error?.code).toBe("DECK_NOT_FOUND");
	});

	it("returns 400 for invalid deck uuid", async () => {
		const res = await app.request("/api/decks/invalid-id/cards", {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(`/api/decks/${DECK_ID}/cards`, {
			method: "GET",
		});

		expect(res.status).toBe(401);
	});
});

describe("POST /api/decks/:deckId/cards", () => {
	let app: Hono;
	let mockCardRepo: ReturnType<typeof createMockCardRepo>;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockCardRepo = createMockCardRepo();
		mockDeckRepo = createMockDeckRepo();
		const cardsRouter = createCardsRouter({
			cardRepo: mockCardRepo,
			deckRepo: mockDeckRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks/:deckId/cards", cardsRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("creates a new card", async () => {
		const newCard = createMockCard({
			deckId: DECK_ID,
			front: "New Question",
			back: "New Answer",
		});
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.create).mockResolvedValue(newCard);

		const res = await app.request(`/api/decks/${DECK_ID}/cards`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ front: "New Question", back: "New Answer" }),
		});

		expect(res.status).toBe(201);
		const body = (await res.json()) as CardResponse;
		expect(body.card?.front).toBe("New Question");
		expect(body.card?.back).toBe("New Answer");
		expect(mockCardRepo.create).toHaveBeenCalledWith(DECK_ID, {
			front: "New Question",
			back: "New Answer",
		});
	});

	it("returns 400 for missing front", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/cards`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ back: "Answer" }),
		});

		expect(res.status).toBe(400);
	});

	it("returns 400 for missing back", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/cards`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ front: "Question" }),
		});

		expect(res.status).toBe(400);
	});

	it("returns 400 for empty front", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/cards`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ front: "", back: "Answer" }),
		});

		expect(res.status).toBe(400);
	});

	it("returns 400 for empty back", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/cards`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ front: "Question", back: "" }),
		});

		expect(res.status).toBe(400);
	});

	it("returns 404 for non-existent deck", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(`/api/decks/${DECK_ID}/cards`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ front: "Question", back: "Answer" }),
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as CardResponse;
		expect(body.error?.code).toBe("DECK_NOT_FOUND");
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(`/api/decks/${DECK_ID}/cards`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ front: "Question", back: "Answer" }),
		});

		expect(res.status).toBe(401);
	});
});

describe("GET /api/decks/:deckId/cards/:cardId", () => {
	let app: Hono;
	let mockCardRepo: ReturnType<typeof createMockCardRepo>;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockCardRepo = createMockCardRepo();
		mockDeckRepo = createMockDeckRepo();
		const cardsRouter = createCardsRouter({
			cardRepo: mockCardRepo,
			deckRepo: mockDeckRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks/:deckId/cards", cardsRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("returns card by id", async () => {
		const mockCard = createMockCard({ id: CARD_ID, deckId: DECK_ID });
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.findById).mockResolvedValue(mockCard);

		const res = await app.request(`/api/decks/${DECK_ID}/cards/${CARD_ID}`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as CardResponse;
		expect(body.card?.id).toBe(CARD_ID);
		expect(mockCardRepo.findById).toHaveBeenCalledWith(CARD_ID, DECK_ID);
	});

	it("returns 404 for non-existent deck", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(`/api/decks/${DECK_ID}/cards/${CARD_ID}`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as CardResponse;
		expect(body.error?.code).toBe("DECK_NOT_FOUND");
	});

	it("returns 404 for non-existent card", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(`/api/decks/${DECK_ID}/cards/${CARD_ID}`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as CardResponse;
		expect(body.error?.code).toBe("CARD_NOT_FOUND");
	});

	it("returns 400 for invalid card uuid", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/cards/invalid-id`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(`/api/decks/${DECK_ID}/cards/${CARD_ID}`, {
			method: "GET",
		});

		expect(res.status).toBe(401);
	});
});

describe("PUT /api/decks/:deckId/cards/:cardId", () => {
	let app: Hono;
	let mockCardRepo: ReturnType<typeof createMockCardRepo>;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockCardRepo = createMockCardRepo();
		mockDeckRepo = createMockDeckRepo();
		const cardsRouter = createCardsRouter({
			cardRepo: mockCardRepo,
			deckRepo: mockDeckRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks/:deckId/cards", cardsRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("updates card front", async () => {
		const updatedCard = createMockCard({
			id: CARD_ID,
			deckId: DECK_ID,
			front: "Updated Question",
		});
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.update).mockResolvedValue(updatedCard);

		const res = await app.request(`/api/decks/${DECK_ID}/cards/${CARD_ID}`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ front: "Updated Question" }),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as CardResponse;
		expect(body.card?.front).toBe("Updated Question");
	});

	it("updates card back", async () => {
		const updatedCard = createMockCard({
			id: CARD_ID,
			deckId: DECK_ID,
			back: "Updated Answer",
		});
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.update).mockResolvedValue(updatedCard);

		const res = await app.request(`/api/decks/${DECK_ID}/cards/${CARD_ID}`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ back: "Updated Answer" }),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as CardResponse;
		expect(body.card?.back).toBe("Updated Answer");
	});

	it("updates both front and back", async () => {
		const updatedCard = createMockCard({
			id: CARD_ID,
			deckId: DECK_ID,
			front: "New Q",
			back: "New A",
		});
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.update).mockResolvedValue(updatedCard);

		const res = await app.request(`/api/decks/${DECK_ID}/cards/${CARD_ID}`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ front: "New Q", back: "New A" }),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as CardResponse;
		expect(body.card?.front).toBe("New Q");
		expect(body.card?.back).toBe("New A");
		expect(mockCardRepo.update).toHaveBeenCalledWith(CARD_ID, DECK_ID, {
			front: "New Q",
			back: "New A",
		});
	});

	it("returns 404 for non-existent deck", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(`/api/decks/${DECK_ID}/cards/${CARD_ID}`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ front: "Test" }),
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as CardResponse;
		expect(body.error?.code).toBe("DECK_NOT_FOUND");
	});

	it("returns 404 for non-existent card", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.update).mockResolvedValue(undefined);

		const res = await app.request(`/api/decks/${DECK_ID}/cards/${CARD_ID}`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ front: "Test" }),
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as CardResponse;
		expect(body.error?.code).toBe("CARD_NOT_FOUND");
	});

	it("returns 400 for invalid card uuid", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/cards/invalid-id`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ front: "Test" }),
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(`/api/decks/${DECK_ID}/cards/${CARD_ID}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ front: "Test" }),
		});

		expect(res.status).toBe(401);
	});
});

describe("DELETE /api/decks/:deckId/cards/:cardId", () => {
	let app: Hono;
	let mockCardRepo: ReturnType<typeof createMockCardRepo>;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockCardRepo = createMockCardRepo();
		mockDeckRepo = createMockDeckRepo();
		const cardsRouter = createCardsRouter({
			cardRepo: mockCardRepo,
			deckRepo: mockDeckRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks/:deckId/cards", cardsRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("deletes card successfully", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.softDelete).mockResolvedValue(true);

		const res = await app.request(`/api/decks/${DECK_ID}/cards/${CARD_ID}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as CardResponse;
		expect(body.success).toBe(true);
		expect(mockCardRepo.softDelete).toHaveBeenCalledWith(CARD_ID, DECK_ID);
	});

	it("returns 404 for non-existent deck", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(`/api/decks/${DECK_ID}/cards/${CARD_ID}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as CardResponse;
		expect(body.error?.code).toBe("DECK_NOT_FOUND");
	});

	it("returns 404 for non-existent card", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.softDelete).mockResolvedValue(false);

		const res = await app.request(`/api/decks/${DECK_ID}/cards/${CARD_ID}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as CardResponse;
		expect(body.error?.code).toBe("CARD_NOT_FOUND");
	});

	it("returns 400 for invalid card uuid", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/cards/invalid-id`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(`/api/decks/${DECK_ID}/cards/${CARD_ID}`, {
			method: "DELETE",
		});

		expect(res.status).toBe(401);
	});
});
