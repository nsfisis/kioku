import { atomFamily } from "jotai-family";
import { atomWithSuspenseQuery } from "jotai-tanstack-query";
import { apiClient } from "../api/client";

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

// =====================
// Decks List - Suspense-compatible
// =====================

export const decksAtom = atomWithSuspenseQuery(() => ({
	queryKey: ["decks"],
	queryFn: async () => {
		const res = await apiClient.rpc.api.decks.$get(undefined, {
			headers: apiClient.getAuthHeader(),
		});
		const data = await apiClient.handleResponse<{ decks: Deck[] }>(res);
		return data.decks;
	},
}));

// =====================
// Single Deck by ID - Suspense-compatible
// =====================

export const deckByIdAtomFamily = atomFamily((deckId: string) =>
	atomWithSuspenseQuery(() => ({
		queryKey: ["decks", deckId],
		queryFn: async () => {
			const res = await apiClient.rpc.api.decks[":id"].$get({
				param: { id: deckId },
			});
			const data = await apiClient.handleResponse<{ deck: Deck }>(res);
			return data.deck;
		},
	})),
);
