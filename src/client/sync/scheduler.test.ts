/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CardState, db, Rating } from "../db/index";
import {
	localCardRepository,
	localDeckRepository,
	localReviewLogRepository,
} from "../db/repositories";
import { syncQueue } from "./queue";
import { submitReviewLocal, undoReviewLocal } from "./scheduler";

async function clearDb() {
	await db.decks.clear();
	await db.cards.clear();
	await db.reviewLogs.clear();
	await db.noteTypes.clear();
	await db.noteFieldTypes.clear();
	await db.notes.clear();
	await db.noteFieldValues.clear();
}

async function seedDeck() {
	const deck = await localDeckRepository.create({
		userId: "user-1",
		name: "Test Deck",
		description: null,
		defaultNoteTypeId: null,
	});
	await localDeckRepository.markSynced(deck.id, 1);
	return deck;
}

async function seedSyncedCard(deckId: string) {
	const card = await localCardRepository.create({
		deckId,
		noteId: "note-1",
		isReversed: false,
		front: "front",
		back: "back",
	});
	await localCardRepository.markSynced(card.id, 1);
	return card;
}

describe("submitReviewLocal", () => {
	beforeEach(async () => {
		await clearDb();
		localStorage.clear();
	});

	afterEach(async () => {
		await clearDb();
		localStorage.clear();
	});

	it("updates card scheduling and creates a review log in IndexedDB", async () => {
		const deck = await seedDeck();
		const card = await seedSyncedCard(deck.id);

		const result = await submitReviewLocal({
			cardId: card.id,
			rating: Rating.Good,
			durationMs: 5000,
		});

		expect(result.card.reps).toBe(1);
		expect(result.card.lastReview).toBeInstanceOf(Date);
		expect(result.card._synced).toBe(false);
		expect(result.reviewLogId).toBeDefined();

		const logs = await localReviewLogRepository.findByCardId(card.id);
		expect(logs).toHaveLength(1);
		expect(logs[0]?.rating).toBe(Rating.Good);
		expect(logs[0]?.userId).toBe(deck.userId);
		expect(logs[0]?.durationMs).toBe(5000);
		expect(logs[0]?._synced).toBe(false);
	});

	it("returns the previous card snapshot for undo", async () => {
		const deck = await seedDeck();
		const card = await seedSyncedCard(deck.id);

		const result = await submitReviewLocal({
			cardId: card.id,
			rating: Rating.Again,
			durationMs: 3000,
		});

		expect(result.prevCard.reps).toBe(0);
		expect(result.prevCard.state).toBe(CardState.New);
	});

	it("queues 5 offline reviews and exposes them as pending changes", async () => {
		const deck = await seedDeck();
		const cards = await Promise.all(
			Array.from({ length: 5 }, () => seedSyncedCard(deck.id)),
		);

		for (const card of cards) {
			await submitReviewLocal({
				cardId: card.id,
				rating: Rating.Good,
				durationMs: 1000,
			});
		}

		const pending = await syncQueue.getPendingChanges();
		expect(pending.cards.filter((c) => !c._synced)).toHaveLength(5);
		expect(pending.reviewLogs).toHaveLength(5);
	});

	it("notifies sync queue listeners after each review", async () => {
		const deck = await seedDeck();
		const card = await seedSyncedCard(deck.id);

		const counts: number[] = [];
		const unsub = syncQueue.subscribe((state) => {
			counts.push(state.pendingCount);
		});

		await submitReviewLocal({
			cardId: card.id,
			rating: Rating.Good,
			durationMs: 1000,
		});

		unsub();
		// Card was synced=true before; now both card and reviewLog are unsynced.
		expect(counts.at(-1)).toBe(2);
	});

	it("throws when the card is missing from local DB", async () => {
		await expect(
			submitReviewLocal({
				cardId: "missing-card",
				rating: Rating.Good,
				durationMs: 1000,
			}),
		).rejects.toThrow(/Card not found/);
	});
});

describe("undoReviewLocal", () => {
	beforeEach(async () => {
		await clearDb();
		localStorage.clear();
	});

	afterEach(async () => {
		await clearDb();
		localStorage.clear();
	});

	it("restores the card and removes the review log", async () => {
		const deck = await seedDeck();
		const card = await seedSyncedCard(deck.id);

		const result = await submitReviewLocal({
			cardId: card.id,
			rating: Rating.Good,
			durationMs: 1000,
		});

		await undoReviewLocal({
			prevCard: result.prevCard,
			reviewLogId: result.reviewLogId,
		});

		const restored = await localCardRepository.findById(card.id);
		expect(restored?.reps).toBe(0);
		expect(restored?.state).toBe(CardState.New);

		const logs = await localReviewLogRepository.findByCardId(card.id);
		expect(logs).toHaveLength(0);
	});
});
