import { apiClient } from "../api/client";
import { createReloadableAtom, createReloadableAtomFamily } from "./utils";

export interface Deck {
	id: string;
	name: string;
	description: string | null;
	newCardsPerDay: number;
	dueCardCount: number;
	createdAt: string;
	updatedAt: string;
}

// =====================
// Decks List - Suspense-compatible
// =====================

export const decksAtom = createReloadableAtom(async () => {
	const res = await apiClient.rpc.api.decks.$get(undefined, {
		headers: apiClient.getAuthHeader(),
	});
	const data = await apiClient.handleResponse<{ decks: Deck[] }>(res);
	return data.decks;
});

// =====================
// Single Deck by ID - Suspense-compatible
// =====================

export const deckByIdAtomFamily = createReloadableAtomFamily(
	async (deckId: string) => {
		const res = await apiClient.rpc.api.decks[":id"].$get({
			param: { id: deckId },
		});
		const data = await apiClient.handleResponse<{ deck: Deck }>(res);
		return data.deck;
	},
);
