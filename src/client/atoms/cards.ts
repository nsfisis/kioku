import { atomFamily } from "jotai/utils";
import { atomWithSuspenseQuery } from "jotai-tanstack-query";
import { apiClient } from "../api/client";

export interface Card {
	id: string;
	deckId: string;
	noteId: string;
	isReversed: boolean;
	front: string;
	back: string;
	state: number;
	due: string;
	reps: number;
	lapses: number;
	createdAt: string;
	updatedAt: string;
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
