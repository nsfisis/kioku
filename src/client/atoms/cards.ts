import { atomFamily } from "jotai-family";
import { atomWithSuspenseQuery } from "jotai-tanstack-query";
import type { CardStateType, LocalCard } from "../db";
import { localCardRepository } from "../db/repositories";
import { ensureBootstrap } from "./sync";

export interface Card {
	id: string;
	deckId: string;
	noteId: string;
	isReversed: boolean;
	front: string;
	back: string;
	state: CardStateType;
	due: string;
	stability: number;
	difficulty: number;
	elapsedDays: number;
	scheduledDays: number;
	reps: number;
	lapses: number;
	lastReview: string | null;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
	syncVersion: number;
}

function localCardToView(card: LocalCard): Card {
	return {
		id: card.id,
		deckId: card.deckId,
		noteId: card.noteId,
		isReversed: card.isReversed,
		front: card.front,
		back: card.back,
		state: card.state,
		due: card.due.toISOString(),
		stability: card.stability,
		difficulty: card.difficulty,
		elapsedDays: card.elapsedDays,
		scheduledDays: card.scheduledDays,
		reps: card.reps,
		lapses: card.lapses,
		lastReview: card.lastReview ? card.lastReview.toISOString() : null,
		createdAt: card.createdAt.toISOString(),
		updatedAt: card.updatedAt.toISOString(),
		deletedAt: card.deletedAt ? card.deletedAt.toISOString() : null,
		syncVersion: card.syncVersion,
	};
}

async function loadCardsByDeck(deckId: string): Promise<Card[]> {
	const cards = await localCardRepository.findByDeckId(deckId);
	cards.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
	return cards.map(localCardToView);
}

// =====================
// Cards by Deck - Suspense-compatible, IndexedDB-first
// =====================

export const cardsByDeckAtomFamily = atomFamily((deckId: string) =>
	atomWithSuspenseQuery(() => ({
		queryKey: ["decks", deckId, "cards"],
		queryFn: async (): Promise<Card[]> => {
			const cards = await loadCardsByDeck(deckId);
			if (cards.length > 0) {
				ensureBootstrap();
				return cards;
			}
			await ensureBootstrap();
			return loadCardsByDeck(deckId);
		},
	})),
);
