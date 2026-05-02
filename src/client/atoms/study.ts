import { atomFamily } from "jotai-family";
import { atomWithSuspenseQuery } from "jotai-tanstack-query";
import { getStartOfStudyDayBoundary } from "../../shared/date";
import { localDeckRepository } from "../db/repositories";
import { buildStudyCards, type StudyCardView } from "../db/study-builder";
import { createSeededRandom, shuffle } from "../utils/random";
import { ensureBootstrap } from "./sync";

export type StudyCard = StudyCardView;

export interface StudyDeck {
	id: string;
	name: string;
}

export interface StudyData {
	deck: StudyDeck;
	cards: StudyCard[];
}

async function loadStudyData(deckId: string): Promise<StudyData | null> {
	const deck = await localDeckRepository.findById(deckId);
	if (!deck || deck.deletedAt !== null) return null;
	const cards = await buildStudyCards(deckId);
	const seed = getStartOfStudyDayBoundary().getTime();
	return {
		deck: { id: deck.id, name: deck.name },
		cards: shuffle(cards, createSeededRandom(seed)),
	};
}

// =====================
// Study Session - Suspense-compatible, IndexedDB-first
// =====================

export const studyDataAtomFamily = atomFamily((deckId: string) =>
	atomWithSuspenseQuery(() => ({
		queryKey: ["decks", deckId, "study"],
		queryFn: async (): Promise<StudyData> => {
			let data = await loadStudyData(deckId);
			if (data) {
				ensureBootstrap();
				return data;
			}
			await ensureBootstrap();
			data = await loadStudyData(deckId);
			if (!data) {
				throw new Error(`Deck not found: ${deckId}`);
			}
			return data;
		},
	})),
);
