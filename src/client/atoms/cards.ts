import { atomFamily } from "jotai-family";
import { atomWithSuspenseQuery } from "jotai-tanstack-query";
import { apiClient } from "../api/client";
import type { CardStateType } from "../db";

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

// =====================
// Cards by Deck - Suspense-compatible
// =====================

export const cardsByDeckAtomFamily = atomFamily((deckId: string) =>
	atomWithSuspenseQuery(() => ({
		queryKey: ["decks", deckId, "cards"],
		queryFn: async () => {
			const res = await apiClient.rpc.api.decks[":deckId"].cards.$get({
				param: { deckId },
			});
			const data = await apiClient.handleResponse<{ cards: Card[] }>(res);
			return data.cards;
		},
	})),
);
