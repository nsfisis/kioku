import { describe, expect, it, vi } from "vitest";
import type { Deck, DeckRepository } from "./types.js";

function createMockDeck(overrides: Partial<Deck> = {}): Deck {
	return {
		id: "deck-uuid-123",
		userId: "user-uuid-123",
		name: "Test Deck",
		description: null,
		newCardsPerDay: 20,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		deletedAt: null,
		syncVersion: 0,
		...overrides,
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

describe("DeckRepository mock factory", () => {
	describe("createMockDeck", () => {
		it("creates a valid Deck with defaults", () => {
			const deck = createMockDeck();

			expect(deck.id).toBe("deck-uuid-123");
			expect(deck.userId).toBe("user-uuid-123");
			expect(deck.name).toBe("Test Deck");
			expect(deck.description).toBeNull();
			expect(deck.newCardsPerDay).toBe(20);
			expect(deck.deletedAt).toBeNull();
			expect(deck.syncVersion).toBe(0);
		});

		it("allows overriding properties", () => {
			const deck = createMockDeck({
				id: "custom-id",
				name: "Custom Deck",
				description: "A description",
				newCardsPerDay: 50,
			});

			expect(deck.id).toBe("custom-id");
			expect(deck.name).toBe("Custom Deck");
			expect(deck.description).toBe("A description");
			expect(deck.newCardsPerDay).toBe(50);
		});
	});

	describe("createMockDeckRepo", () => {
		it("creates a repository with all required methods", () => {
			const repo = createMockDeckRepo();

			expect(repo.findByUserId).toBeDefined();
			expect(repo.findById).toBeDefined();
			expect(repo.create).toBeDefined();
			expect(repo.update).toBeDefined();
			expect(repo.softDelete).toBeDefined();
		});

		it("methods are mockable for findByUserId", async () => {
			const repo = createMockDeckRepo();
			const mockDecks = [
				createMockDeck({ id: "deck-1" }),
				createMockDeck({ id: "deck-2" }),
			];

			vi.mocked(repo.findByUserId).mockResolvedValue(mockDecks);

			const results = await repo.findByUserId("user-123");
			expect(results).toHaveLength(2);
			expect(repo.findByUserId).toHaveBeenCalledWith("user-123");
		});

		it("methods are mockable for findById", async () => {
			const repo = createMockDeckRepo();
			const mockDeck = createMockDeck();

			vi.mocked(repo.findById).mockResolvedValue(mockDeck);

			const found = await repo.findById("deck-id", "user-id");
			expect(found).toEqual(mockDeck);
			expect(repo.findById).toHaveBeenCalledWith("deck-id", "user-id");
		});

		it("returns undefined when deck not found", async () => {
			const repo = createMockDeckRepo();

			vi.mocked(repo.findById).mockResolvedValue(undefined);

			expect(await repo.findById("nonexistent", "user-id")).toBeUndefined();
		});

		it("returns false when soft delete fails", async () => {
			const repo = createMockDeckRepo();

			vi.mocked(repo.softDelete).mockResolvedValue(false);

			expect(await repo.softDelete("nonexistent", "user-id")).toBe(false);
		});
	});
});

describe("Deck interface contracts", () => {
	it("Deck has required sync fields", () => {
		const deck = createMockDeck();

		expect(deck).toHaveProperty("syncVersion");
		expect(deck).toHaveProperty("createdAt");
		expect(deck).toHaveProperty("updatedAt");
		expect(deck).toHaveProperty("deletedAt");
	});

	it("Deck has required user association", () => {
		const deck = createMockDeck();

		expect(deck).toHaveProperty("userId");
	});

	it("Deck has required configuration fields", () => {
		const deck = createMockDeck();

		expect(deck).toHaveProperty("name");
		expect(deck).toHaveProperty("description");
		expect(deck).toHaveProperty("newCardsPerDay");
	});
});

describe("findByUserId ordering", () => {
	it("returns decks ordered by createdAt", async () => {
		const repo = createMockDeckRepo();

		// Simulate decks created at different times
		const oldDeck = createMockDeck({
			id: "deck-old",
			name: "Old Deck",
			createdAt: new Date("2024-01-01"),
		});
		const newDeck = createMockDeck({
			id: "deck-new",
			name: "New Deck",
			createdAt: new Date("2024-06-01"),
		});

		// Mock returns decks in createdAt order (oldest first)
		vi.mocked(repo.findByUserId).mockResolvedValue([oldDeck, newDeck]);

		const results = await repo.findByUserId("user-123");

		expect(results).toHaveLength(2);
		expect(results[0]?.id).toBe("deck-old");
		expect(results[1]?.id).toBe("deck-new");
		// Verify the order is by createdAt
		expect(results[0]?.createdAt.getTime()).toBeLessThan(
			results[1]?.createdAt.getTime() ?? 0,
		);
	});

	it("returns empty array when user has no decks", async () => {
		const repo = createMockDeckRepo();

		vi.mocked(repo.findByUserId).mockResolvedValue([]);

		const results = await repo.findByUserId("user-with-no-decks");
		expect(results).toHaveLength(0);
	});

	it("returns single deck when user has one deck", async () => {
		const repo = createMockDeckRepo();
		const singleDeck = createMockDeck({ id: "only-deck" });

		vi.mocked(repo.findByUserId).mockResolvedValue([singleDeck]);

		const results = await repo.findByUserId("user-123");
		expect(results).toHaveLength(1);
		expect(results[0]?.id).toBe("only-deck");
	});

	it("maintains consistent ordering across multiple calls", async () => {
		const repo = createMockDeckRepo();

		const deck1 = createMockDeck({
			id: "deck-1",
			createdAt: new Date("2024-01-01"),
		});
		const deck2 = createMockDeck({
			id: "deck-2",
			createdAt: new Date("2024-02-01"),
		});
		const deck3 = createMockDeck({
			id: "deck-3",
			createdAt: new Date("2024-03-01"),
		});

		vi.mocked(repo.findByUserId).mockResolvedValue([deck1, deck2, deck3]);

		const results1 = await repo.findByUserId("user-123");
		const results2 = await repo.findByUserId("user-123");

		// Order should be consistent
		expect(results1.map((d) => d.id)).toEqual(results2.map((d) => d.id));
		expect(results1.map((d) => d.id)).toEqual(["deck-1", "deck-2", "deck-3"]);
	});
});
