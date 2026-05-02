import { atomFamily } from "jotai-family";
import { atomWithSuspenseQuery } from "jotai-tanstack-query";
import { getStartOfStudyDayBoundary } from "../../shared/date";
import { apiClient } from "../api/client";
import type { CardStateType } from "../db";
import { cacheStudyCards, type ServerStudyCard } from "../sync";
import { createSeededRandom, shuffle } from "../utils/random";

export interface StudyCard extends ServerStudyCard {
	state: CardStateType;
	noteType: {
		frontTemplate: string;
		backTemplate: string;
	};
	fieldValuesMap: Record<string, string>;
}

export interface StudyDeck {
	id: string;
	name: string;
}

export interface StudyData {
	deck: StudyDeck;
	cards: StudyCard[];
}

// =====================
// Study Session - Suspense-compatible
// =====================

export const studyDataAtomFamily = atomFamily((deckId: string) =>
	atomWithSuspenseQuery(() => ({
		queryKey: ["decks", deckId, "study"],
		queryFn: async (): Promise<StudyData> => {
			// Fetch deck and due cards in parallel
			const [deckRes, cardsRes] = await Promise.all([
				apiClient.rpc.api.decks[":id"].$get({ param: { id: deckId } }),
				apiClient.rpc.api.decks[":deckId"].study.$get({ param: { deckId } }),
			]);

			const deckData = await apiClient.handleResponse<{ deck: StudyDeck }>(
				deckRes,
			);
			const cardsData = await apiClient.handleResponse<{
				cards: StudyCard[];
			}>(cardsRes);

			// Cache cards in IndexedDB so reviews can be submitted offline.
			await cacheStudyCards(cardsData.cards);

			const seed = getStartOfStudyDayBoundary().getTime();
			return {
				deck: deckData.deck,
				cards: shuffle(cardsData.cards, createSeededRandom(seed)),
			};
		},
	})),
);
