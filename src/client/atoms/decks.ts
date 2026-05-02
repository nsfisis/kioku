import { atomFamily } from "jotai-family";
import { atomWithSuspenseQuery } from "jotai-tanstack-query";
import { getEndOfStudyDayBoundary } from "../../shared/date";
import { CardState, db, type LocalDeck } from "../db";
import { localDeckRepository } from "../db/repositories";
import { ensureBootstrap } from "./sync";

export interface Deck {
	id: string;
	name: string;
	description: string | null;
	defaultNoteTypeId: string | null;
	dueCardCount: number;
	newCardCount: number;
	totalCardCount: number;
	reviewCardCount: number;
	createdAt: string;
	updatedAt: string;
}

async function loadCurrentUserId(): Promise<string | null> {
	const stored = localStorage.getItem("kioku_user");
	if (!stored) return null;
	try {
		const user = JSON.parse(stored) as { id?: string } | null;
		return user?.id ?? null;
	} catch {
		return null;
	}
}

interface DeckCardCounts {
	dueCardCount: number;
	newCardCount: number;
	totalCardCount: number;
	reviewCardCount: number;
}

async function computeDeckCounts(
	deckId: string,
	dueBoundary: Date,
): Promise<DeckCardCounts> {
	const cards = await db.cards.where("deckId").equals(deckId).toArray();
	let due = 0;
	let news = 0;
	let total = 0;
	let review = 0;
	for (const card of cards) {
		if (card.deletedAt !== null) continue;
		total++;
		if (card.due < dueBoundary) due++;
		if (card.state === CardState.New) news++;
		if (card.state === CardState.Review) review++;
	}
	return {
		dueCardCount: due,
		newCardCount: news,
		totalCardCount: total,
		reviewCardCount: review,
	};
}

function localDeckToView(deck: LocalDeck, counts: DeckCardCounts): Deck {
	return {
		id: deck.id,
		name: deck.name,
		description: deck.description,
		defaultNoteTypeId: deck.defaultNoteTypeId,
		dueCardCount: counts.dueCardCount,
		newCardCount: counts.newCardCount,
		totalCardCount: counts.totalCardCount,
		reviewCardCount: counts.reviewCardCount,
		createdAt: deck.createdAt.toISOString(),
		updatedAt: deck.updatedAt.toISOString(),
	};
}

async function loadDecksFromIndexedDb(): Promise<Deck[]> {
	const userId = await loadCurrentUserId();
	if (!userId) return [];
	const decks = await localDeckRepository.findByUserId(userId);
	const boundary = getEndOfStudyDayBoundary(new Date());
	decks.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
	return Promise.all(
		decks.map(async (deck) => {
			const counts = await computeDeckCounts(deck.id, boundary);
			return localDeckToView(deck, counts);
		}),
	);
}

// =====================
// Decks List - Suspense-compatible, IndexedDB-first
// =====================

export const decksAtom = atomWithSuspenseQuery(() => ({
	queryKey: ["decks"],
	queryFn: async (): Promise<Deck[]> => {
		const decks = await loadDecksFromIndexedDb();
		if (decks.length > 0) {
			// Stale-while-revalidate: kick a background pull so the next
			// invalidation reflects upstream changes.
			ensureBootstrap();
			return decks;
		}
		// IndexedDB is empty — wait for the initial pull to populate it
		// before deciding there really are no decks.
		await ensureBootstrap();
		return loadDecksFromIndexedDb();
	},
}));

// =====================
// Single Deck by ID - Suspense-compatible, IndexedDB-first
// =====================

async function loadDeckById(deckId: string): Promise<Deck | null> {
	const deck = await localDeckRepository.findById(deckId);
	if (!deck || deck.deletedAt !== null) return null;
	const boundary = getEndOfStudyDayBoundary(new Date());
	const counts = await computeDeckCounts(deck.id, boundary);
	return localDeckToView(deck, counts);
}

export const deckByIdAtomFamily = atomFamily((deckId: string) =>
	atomWithSuspenseQuery(() => ({
		queryKey: ["decks", deckId],
		queryFn: async (): Promise<Deck> => {
			let deck = await loadDeckById(deckId);
			if (deck) {
				ensureBootstrap();
				return deck;
			}
			await ensureBootstrap();
			deck = await loadDeckById(deckId);
			if (!deck) {
				throw new Error(`Deck not found: ${deckId}`);
			}
			return deck;
		},
	})),
);
