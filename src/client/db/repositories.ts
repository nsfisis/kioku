import { v4 as uuidv4 } from "uuid";
import {
	CardState,
	type CardStateType,
	db,
	type LocalCard,
	type LocalDeck,
	type LocalReviewLog,
	type RatingType,
} from "./index";

/**
 * Local deck repository for IndexedDB operations
 */
export const localDeckRepository = {
	/**
	 * Get all decks for a user (excluding soft-deleted)
	 */
	async findByUserId(userId: string): Promise<LocalDeck[]> {
		return db.decks
			.where("userId")
			.equals(userId)
			.filter((deck) => deck.deletedAt === null)
			.toArray();
	},

	/**
	 * Get a deck by ID
	 */
	async findById(id: string): Promise<LocalDeck | undefined> {
		return db.decks.get(id);
	},

	/**
	 * Create a new deck
	 */
	async create(
		data: Omit<
			LocalDeck,
			"id" | "createdAt" | "updatedAt" | "deletedAt" | "syncVersion" | "_synced"
		>,
	): Promise<LocalDeck> {
		const now = new Date();
		const deck: LocalDeck = {
			id: uuidv4(),
			...data,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncVersion: 0,
			_synced: false,
		};
		await db.decks.add(deck);
		return deck;
	},

	/**
	 * Update a deck
	 */
	async update(
		id: string,
		data: Partial<Pick<LocalDeck, "name" | "description" | "newCardsPerDay">>,
	): Promise<LocalDeck | undefined> {
		const deck = await db.decks.get(id);
		if (!deck) return undefined;

		const updatedDeck: LocalDeck = {
			...deck,
			...data,
			updatedAt: new Date(),
			_synced: false,
		};
		await db.decks.put(updatedDeck);
		return updatedDeck;
	},

	/**
	 * Soft delete a deck
	 */
	async delete(id: string): Promise<boolean> {
		const deck = await db.decks.get(id);
		if (!deck) return false;

		await db.decks.update(id, {
			deletedAt: new Date(),
			updatedAt: new Date(),
			_synced: false,
		});
		return true;
	},

	/**
	 * Get all unsynced decks
	 */
	async findUnsynced(): Promise<LocalDeck[]> {
		return db.decks.filter((deck) => !deck._synced).toArray();
	},

	/**
	 * Mark a deck as synced
	 */
	async markSynced(id: string, syncVersion: number): Promise<void> {
		await db.decks.update(id, { _synced: true, syncVersion });
	},

	/**
	 * Upsert a deck from server (for sync pull)
	 */
	async upsertFromServer(deck: LocalDeck): Promise<void> {
		await db.decks.put({ ...deck, _synced: true });
	},
};

/**
 * Local card repository for IndexedDB operations
 */
export const localCardRepository = {
	/**
	 * Get all cards for a deck (excluding soft-deleted)
	 */
	async findByDeckId(deckId: string): Promise<LocalCard[]> {
		return db.cards
			.where("deckId")
			.equals(deckId)
			.filter((card) => card.deletedAt === null)
			.toArray();
	},

	/**
	 * Get a card by ID
	 */
	async findById(id: string): Promise<LocalCard | undefined> {
		return db.cards.get(id);
	},

	/**
	 * Get due cards for a deck
	 */
	async findDueCards(deckId: string, limit?: number): Promise<LocalCard[]> {
		const now = new Date();
		const query = db.cards
			.where("deckId")
			.equals(deckId)
			.filter((card) => card.deletedAt === null && card.due <= now);

		const cards = await query.toArray();
		// Sort by due date ascending
		cards.sort((a, b) => a.due.getTime() - b.due.getTime());

		return limit ? cards.slice(0, limit) : cards;
	},

	/**
	 * Get new cards for a deck (cards that haven't been reviewed yet)
	 */
	async findNewCards(deckId: string, limit?: number): Promise<LocalCard[]> {
		const cards = await db.cards
			.where("deckId")
			.equals(deckId)
			.filter((card) => card.deletedAt === null && card.state === CardState.New)
			.toArray();

		// Sort by creation date ascending
		cards.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

		return limit ? cards.slice(0, limit) : cards;
	},

	/**
	 * Create a new card
	 */
	async create(
		data: Omit<
			LocalCard,
			| "id"
			| "state"
			| "due"
			| "stability"
			| "difficulty"
			| "elapsedDays"
			| "scheduledDays"
			| "reps"
			| "lapses"
			| "lastReview"
			| "createdAt"
			| "updatedAt"
			| "deletedAt"
			| "syncVersion"
			| "_synced"
		>,
	): Promise<LocalCard> {
		const now = new Date();
		const card: LocalCard = {
			id: uuidv4(),
			...data,
			state: CardState.New,
			due: now,
			stability: 0,
			difficulty: 0,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: 0,
			lapses: 0,
			lastReview: null,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncVersion: 0,
			_synced: false,
		};
		await db.cards.add(card);
		return card;
	},

	/**
	 * Update a card's content
	 */
	async update(
		id: string,
		data: Partial<Pick<LocalCard, "front" | "back">>,
	): Promise<LocalCard | undefined> {
		const card = await db.cards.get(id);
		if (!card) return undefined;

		const updatedCard: LocalCard = {
			...card,
			...data,
			updatedAt: new Date(),
			_synced: false,
		};
		await db.cards.put(updatedCard);
		return updatedCard;
	},

	/**
	 * Update a card's FSRS scheduling data after review
	 */
	async updateScheduling(
		id: string,
		data: Pick<
			LocalCard,
			| "state"
			| "due"
			| "stability"
			| "difficulty"
			| "elapsedDays"
			| "scheduledDays"
			| "reps"
			| "lapses"
			| "lastReview"
		>,
	): Promise<LocalCard | undefined> {
		const card = await db.cards.get(id);
		if (!card) return undefined;

		const updatedCard: LocalCard = {
			...card,
			...data,
			updatedAt: new Date(),
			_synced: false,
		};
		await db.cards.put(updatedCard);
		return updatedCard;
	},

	/**
	 * Soft delete a card
	 */
	async delete(id: string): Promise<boolean> {
		const card = await db.cards.get(id);
		if (!card) return false;

		await db.cards.update(id, {
			deletedAt: new Date(),
			updatedAt: new Date(),
			_synced: false,
		});
		return true;
	},

	/**
	 * Get all unsynced cards
	 */
	async findUnsynced(): Promise<LocalCard[]> {
		return db.cards.filter((card) => !card._synced).toArray();
	},

	/**
	 * Mark a card as synced
	 */
	async markSynced(id: string, syncVersion: number): Promise<void> {
		await db.cards.update(id, { _synced: true, syncVersion });
	},

	/**
	 * Upsert a card from server (for sync pull)
	 */
	async upsertFromServer(card: LocalCard): Promise<void> {
		await db.cards.put({ ...card, _synced: true });
	},
};

/**
 * Local review log repository for IndexedDB operations
 */
export const localReviewLogRepository = {
	/**
	 * Get all review logs for a card
	 */
	async findByCardId(cardId: string): Promise<LocalReviewLog[]> {
		return db.reviewLogs.where("cardId").equals(cardId).toArray();
	},

	/**
	 * Get all review logs for a user
	 */
	async findByUserId(userId: string): Promise<LocalReviewLog[]> {
		return db.reviewLogs.where("userId").equals(userId).toArray();
	},

	/**
	 * Get a review log by ID
	 */
	async findById(id: string): Promise<LocalReviewLog | undefined> {
		return db.reviewLogs.get(id);
	},

	/**
	 * Create a new review log
	 */
	async create(
		data: Omit<LocalReviewLog, "id" | "syncVersion" | "_synced">,
	): Promise<LocalReviewLog> {
		const reviewLog: LocalReviewLog = {
			id: uuidv4(),
			...data,
			syncVersion: 0,
			_synced: false,
		};
		await db.reviewLogs.add(reviewLog);
		return reviewLog;
	},

	/**
	 * Get all unsynced review logs
	 */
	async findUnsynced(): Promise<LocalReviewLog[]> {
		return db.reviewLogs.filter((log) => !log._synced).toArray();
	},

	/**
	 * Mark a review log as synced
	 */
	async markSynced(id: string, syncVersion: number): Promise<void> {
		await db.reviewLogs.update(id, { _synced: true, syncVersion });
	},

	/**
	 * Upsert a review log from server (for sync pull)
	 */
	async upsertFromServer(reviewLog: LocalReviewLog): Promise<void> {
		await db.reviewLogs.put({ ...reviewLog, _synced: true });
	},

	/**
	 * Get review logs within a date range
	 */
	async findByDateRange(
		userId: string,
		startDate: Date,
		endDate: Date,
	): Promise<LocalReviewLog[]> {
		return db.reviewLogs
			.where("userId")
			.equals(userId)
			.filter((log) => log.reviewedAt >= startDate && log.reviewedAt <= endDate)
			.toArray();
	},
};
