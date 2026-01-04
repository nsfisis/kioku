import { apiClient } from "../api/client";
import { createReloadableAtomFamily } from "./utils";

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

export const cardsByDeckAtomFamily = createReloadableAtomFamily(
	async (deckId: string) => {
		const res = await apiClient.rpc.api.decks[":deckId"].cards.$get({
			param: { deckId },
		});
		const data = await apiClient.handleResponse<{ cards: Card[] }>(res);
		return data.cards;
	},
);
