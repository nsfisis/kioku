import type { CardStateType } from "./index";
import {
	localCardRepository,
	localNoteFieldTypeRepository,
	localNoteFieldValueRepository,
	localNoteRepository,
	localNoteTypeRepository,
} from "./repositories";

export interface StudyCardView {
	id: string;
	deckId: string;
	noteId: string;
	isReversed: boolean;
	state: CardStateType;
	noteType: {
		frontTemplate: string;
		backTemplate: string;
	};
	fieldValuesMap: Record<string, string>;
}

/**
 * Build study card views for all due cards in a deck from IndexedDB.
 *
 * Cards whose note or note type has been soft-deleted are skipped, mirroring
 * the server-side enrichment in `enrichCardsForStudy`.
 */
export async function buildStudyCards(
	deckId: string,
): Promise<StudyCardView[]> {
	const dueCards = await localCardRepository.findDueCards(deckId);
	if (dueCards.length === 0) {
		return [];
	}

	const noteTypeFieldsCache = new Map<string, Map<string, string>>();
	const result: StudyCardView[] = [];

	for (const card of dueCards) {
		const note = await localNoteRepository.findById(card.noteId);
		if (!note || note.deletedAt !== null) continue;

		const noteType = await localNoteTypeRepository.findById(note.noteTypeId);
		if (!noteType || noteType.deletedAt !== null) continue;

		let fieldTypeIdToName = noteTypeFieldsCache.get(noteType.id);
		if (!fieldTypeIdToName) {
			const fieldTypes = await localNoteFieldTypeRepository.findByNoteTypeId(
				noteType.id,
			);
			fieldTypeIdToName = new Map(fieldTypes.map((ft) => [ft.id, ft.name]));
			noteTypeFieldsCache.set(noteType.id, fieldTypeIdToName);
		}

		const fieldValues = await localNoteFieldValueRepository.findByNoteId(
			note.id,
		);
		const fieldValuesMap: Record<string, string> = {};
		for (const fv of fieldValues) {
			const name = fieldTypeIdToName.get(fv.noteFieldTypeId);
			if (name) {
				fieldValuesMap[name] = fv.value;
			}
		}

		result.push({
			id: card.id,
			deckId: card.deckId,
			noteId: card.noteId,
			isReversed: card.isReversed,
			state: card.state,
			noteType: {
				frontTemplate: noteType.frontTemplate,
				backTemplate: noteType.backTemplate,
			},
			fieldValuesMap,
		});
	}

	return result;
}
