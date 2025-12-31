import { Hono } from "hono";
import { sign } from "hono/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardState, Rating } from "../db/schema.js";
import { errorHandler } from "../middleware/index.js";
import type {
	Card,
	CardForStudy,
	CardRepository,
	Deck,
	DeckRepository,
	ReviewLog,
	ReviewLogRepository,
} from "../repositories/index.js";
import { createStudyRouter } from "./study.js";

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
		findDueCardsWithNoteData: vi.fn(),
		findDueCardsForStudy: vi.fn(),
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

function createMockReviewLogRepo(): ReviewLogRepository {
	return {
		create: vi.fn(),
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
		noteId: null,
		isReversed: null,
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

function createMockReviewLog(overrides: Partial<ReviewLog> = {}): ReviewLog {
	return {
		id: "review-log-uuid-123",
		cardId: "card-uuid-123",
		userId: "user-uuid-123",
		rating: Rating.Good,
		state: CardState.New,
		scheduledDays: 1,
		elapsedDays: 0,
		reviewedAt: new Date("2024-01-01"),
		durationMs: null,
		syncVersion: 0,
		...overrides,
	};
}

function createMockCardForStudy(
	overrides: Partial<CardForStudy> = {},
): CardForStudy {
	return {
		...createMockCard(overrides),
		noteType: overrides.noteType ?? null,
		fieldValuesMap: overrides.fieldValuesMap ?? {},
	};
}

interface StudyResponse {
	card?: Card;
	cards?: CardForStudy[];
	error?: {
		code: string;
		message: string;
	};
}

const DECK_ID = "00000000-0000-4000-8000-000000000001";
const CARD_ID = "00000000-0000-4000-8000-000000000002";

describe("GET /api/decks/:deckId/study", () => {
	let app: Hono;
	let mockCardRepo: ReturnType<typeof createMockCardRepo>;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let mockReviewLogRepo: ReturnType<typeof createMockReviewLogRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockCardRepo = createMockCardRepo();
		mockDeckRepo = createMockDeckRepo();
		mockReviewLogRepo = createMockReviewLogRepo();
		const studyRouter = createStudyRouter({
			cardRepo: mockCardRepo,
			deckRepo: mockDeckRepo,
			reviewLogRepo: mockReviewLogRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks/:deckId/study", studyRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("returns empty array when no cards are due", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.findDueCardsForStudy).mockResolvedValue([]);

		const res = await app.request(`/api/decks/${DECK_ID}/study`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as StudyResponse;
		expect(body.cards).toEqual([]);
		expect(mockDeckRepo.findById).toHaveBeenCalledWith(
			DECK_ID,
			"user-uuid-123",
		);
		expect(mockCardRepo.findDueCardsForStudy).toHaveBeenCalledWith(
			DECK_ID,
			expect.any(Date),
			100,
		);
	});

	it("returns due cards (legacy cards without note)", async () => {
		const mockCards = [
			createMockCardForStudy({
				id: "card-1",
				front: "Q1",
				back: "A1",
				noteType: null,
				fieldValuesMap: {},
			}),
			createMockCardForStudy({
				id: "card-2",
				front: "Q2",
				back: "A2",
				noteType: null,
				fieldValuesMap: {},
			}),
		];
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.findDueCardsForStudy).mockResolvedValue(mockCards);

		const res = await app.request(`/api/decks/${DECK_ID}/study`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as StudyResponse;
		expect(body.cards).toHaveLength(2);
		expect(body.cards?.[0]?.noteType).toBeNull();
	});

	it("returns due cards with note type and field values when available", async () => {
		const mockCards = [
			createMockCardForStudy({
				id: "card-1",
				noteId: "note-1",
				isReversed: false,
				noteType: {
					frontTemplate: "{{Front}}",
					backTemplate: "{{Back}}",
				},
				fieldValuesMap: {
					Front: "Question",
					Back: "Answer",
				},
			}),
		];
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.findDueCardsForStudy).mockResolvedValue(mockCards);

		const res = await app.request(`/api/decks/${DECK_ID}/study`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as StudyResponse;
		expect(body.cards).toHaveLength(1);
		expect(body.cards?.[0]?.noteType?.frontTemplate).toBe("{{Front}}");
		expect(body.cards?.[0]?.fieldValuesMap?.Front).toBe("Question");
	});

	it("returns 404 for non-existent deck", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(`/api/decks/${DECK_ID}/study`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as StudyResponse;
		expect(body.error?.code).toBe("DECK_NOT_FOUND");
	});

	it("returns 400 for invalid deck uuid", async () => {
		const res = await app.request("/api/decks/invalid-id/study", {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(`/api/decks/${DECK_ID}/study`, {
			method: "GET",
		});

		expect(res.status).toBe(401);
	});
});

describe("POST /api/decks/:deckId/study/:cardId", () => {
	let app: Hono;
	let mockCardRepo: ReturnType<typeof createMockCardRepo>;
	let mockDeckRepo: ReturnType<typeof createMockDeckRepo>;
	let mockReviewLogRepo: ReturnType<typeof createMockReviewLogRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockCardRepo = createMockCardRepo();
		mockDeckRepo = createMockDeckRepo();
		mockReviewLogRepo = createMockReviewLogRepo();
		const studyRouter = createStudyRouter({
			cardRepo: mockCardRepo,
			deckRepo: mockDeckRepo,
			reviewLogRepo: mockReviewLogRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/decks/:deckId/study", studyRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("submits a review with rating Good", async () => {
		const card = createMockCard({ id: CARD_ID, deckId: DECK_ID });
		const updatedCard = createMockCard({
			id: CARD_ID,
			deckId: DECK_ID,
			state: CardState.Learning,
			reps: 1,
		});
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.findById).mockResolvedValue(card);
		vi.mocked(mockCardRepo.updateFSRSFields).mockResolvedValue(updatedCard);
		vi.mocked(mockReviewLogRepo.create).mockResolvedValue(
			createMockReviewLog(),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/study/${CARD_ID}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ rating: Rating.Good }),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as StudyResponse;
		expect(body.card).toBeDefined();
		expect(mockCardRepo.updateFSRSFields).toHaveBeenCalledWith(
			CARD_ID,
			DECK_ID,
			expect.objectContaining({
				state: expect.any(Number),
				due: expect.any(Date),
				stability: expect.any(Number),
				difficulty: expect.any(Number),
			}),
		);
		expect(mockReviewLogRepo.create).toHaveBeenCalledWith(
			expect.objectContaining({
				cardId: CARD_ID,
				userId: "user-uuid-123",
				rating: Rating.Good,
			}),
		);
	});

	it("submits a review with rating Again", async () => {
		const card = createMockCard({ id: CARD_ID, deckId: DECK_ID });
		const updatedCard = createMockCard({
			id: CARD_ID,
			deckId: DECK_ID,
			state: CardState.Learning,
		});
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.findById).mockResolvedValue(card);
		vi.mocked(mockCardRepo.updateFSRSFields).mockResolvedValue(updatedCard);
		vi.mocked(mockReviewLogRepo.create).mockResolvedValue(
			createMockReviewLog(),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/study/${CARD_ID}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ rating: Rating.Again }),
		});

		expect(res.status).toBe(200);
		expect(mockCardRepo.updateFSRSFields).toHaveBeenCalled();
	});

	it("submits a review with rating Hard", async () => {
		const card = createMockCard({ id: CARD_ID, deckId: DECK_ID });
		const updatedCard = createMockCard({ id: CARD_ID, deckId: DECK_ID });
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.findById).mockResolvedValue(card);
		vi.mocked(mockCardRepo.updateFSRSFields).mockResolvedValue(updatedCard);
		vi.mocked(mockReviewLogRepo.create).mockResolvedValue(
			createMockReviewLog(),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/study/${CARD_ID}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ rating: Rating.Hard }),
		});

		expect(res.status).toBe(200);
		expect(mockCardRepo.updateFSRSFields).toHaveBeenCalled();
	});

	it("submits a review with rating Easy", async () => {
		const card = createMockCard({ id: CARD_ID, deckId: DECK_ID });
		const updatedCard = createMockCard({ id: CARD_ID, deckId: DECK_ID });
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.findById).mockResolvedValue(card);
		vi.mocked(mockCardRepo.updateFSRSFields).mockResolvedValue(updatedCard);
		vi.mocked(mockReviewLogRepo.create).mockResolvedValue(
			createMockReviewLog(),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/study/${CARD_ID}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ rating: Rating.Easy }),
		});

		expect(res.status).toBe(200);
		expect(mockCardRepo.updateFSRSFields).toHaveBeenCalled();
	});

	it("includes durationMs in review log when provided", async () => {
		const card = createMockCard({ id: CARD_ID, deckId: DECK_ID });
		const updatedCard = createMockCard({ id: CARD_ID, deckId: DECK_ID });
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.findById).mockResolvedValue(card);
		vi.mocked(mockCardRepo.updateFSRSFields).mockResolvedValue(updatedCard);
		vi.mocked(mockReviewLogRepo.create).mockResolvedValue(
			createMockReviewLog(),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/study/${CARD_ID}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ rating: Rating.Good, durationMs: 5000 }),
		});

		expect(res.status).toBe(200);
		expect(mockReviewLogRepo.create).toHaveBeenCalledWith(
			expect.objectContaining({
				durationMs: 5000,
			}),
		);
	});

	it("returns 404 for non-existent deck", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(`/api/decks/${DECK_ID}/study/${CARD_ID}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ rating: Rating.Good }),
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as StudyResponse;
		expect(body.error?.code).toBe("DECK_NOT_FOUND");
	});

	it("returns 404 for non-existent card", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(`/api/decks/${DECK_ID}/study/${CARD_ID}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ rating: Rating.Good }),
		});

		expect(res.status).toBe(404);
		const body = (await res.json()) as StudyResponse;
		expect(body.error?.code).toBe("CARD_NOT_FOUND");
	});

	it("returns 400 for invalid rating", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/study/${CARD_ID}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ rating: 5 }),
		});

		expect(res.status).toBe(400);
	});

	it("returns 400 for missing rating", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/study/${CARD_ID}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({}),
		});

		expect(res.status).toBe(400);
	});

	it("returns 400 for invalid card uuid", async () => {
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/study/invalid-id`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ rating: Rating.Good }),
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(`/api/decks/${DECK_ID}/study/${CARD_ID}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ rating: Rating.Good }),
		});

		expect(res.status).toBe(401);
	});

	it("handles card with previous reviews", async () => {
		const lastReviewDate = new Date("2024-01-01");
		const card = createMockCard({
			id: CARD_ID,
			deckId: DECK_ID,
			state: CardState.Review,
			lastReview: lastReviewDate,
			reps: 5,
			stability: 10,
			difficulty: 5,
		});
		const updatedCard = createMockCard({
			id: CARD_ID,
			deckId: DECK_ID,
			state: CardState.Review,
		});
		vi.mocked(mockDeckRepo.findById).mockResolvedValue(
			createMockDeck({ id: DECK_ID }),
		);
		vi.mocked(mockCardRepo.findById).mockResolvedValue(card);
		vi.mocked(mockCardRepo.updateFSRSFields).mockResolvedValue(updatedCard);
		vi.mocked(mockReviewLogRepo.create).mockResolvedValue(
			createMockReviewLog(),
		);

		const res = await app.request(`/api/decks/${DECK_ID}/study/${CARD_ID}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ rating: Rating.Good }),
		});

		expect(res.status).toBe(200);
		expect(mockCardRepo.updateFSRSFields).toHaveBeenCalled();
		expect(mockReviewLogRepo.create).toHaveBeenCalled();
	});
});
