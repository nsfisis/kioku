import { apiClient } from "../api/client";
import { shuffle } from "../utils/shuffle";
import { createReloadableAtomFamily } from "./utils";

export interface StudyCard {
	id: string;
	deckId: string;
	noteId: string;
	isReversed: boolean;
	front: string;
	back: string;
	state: number;
	due: string;
	stability: number;
	difficulty: number;
	reps: number;
	lapses: number;
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

export const studyDataAtomFamily = createReloadableAtomFamily(
	async (deckId: string): Promise<StudyData> => {
		// Fetch deck and due cards in parallel
		const [deckRes, cardsRes] = await Promise.all([
			apiClient.rpc.api.decks[":id"].$get({ param: { id: deckId } }),
			apiClient.rpc.api.decks[":deckId"].study.$get({ param: { deckId } }),
		]);

		const deckData = await apiClient.handleResponse<{ deck: StudyDeck }>(
			deckRes,
		);
		const cardsData = await apiClient.handleResponse<{ cards: StudyCard[] }>(
			cardsRes,
		);

		return {
			deck: deckData.deck,
			cards: shuffle(cardsData.cards),
		};
	},
);
