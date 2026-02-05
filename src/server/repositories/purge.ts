import { and, inArray, isNotNull, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import {
	cards,
	decks,
	noteFieldTypes,
	noteFieldValues,
	notes,
	noteTypes,
	reviewLogs,
} from "../db/schema.js";

export interface PurgeResult {
	reviewLogs: number;
	noteFieldValues: number;
	cards: number;
	notes: number;
	noteFieldTypes: number;
	noteTypes: number;
	decks: number;
}

export interface PurgeOptions {
	retentionDays: number;
	batchSize?: number;
}

export interface PurgeRepository {
	purgeDeletedRecords(options: PurgeOptions): Promise<PurgeResult>;
}

const DEFAULT_BATCH_SIZE = 1000;

export const purgeRepository: PurgeRepository = {
	async purgeDeletedRecords(options: PurgeOptions): Promise<PurgeResult> {
		const { retentionDays, batchSize = DEFAULT_BATCH_SIZE } = options;
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

		const result: PurgeResult = {
			reviewLogs: 0,
			noteFieldValues: 0,
			cards: 0,
			notes: 0,
			noteFieldTypes: 0,
			noteTypes: 0,
			decks: 0,
		};

		await db.transaction(async (tx) => {
			// 1. Delete review_logs for cards that will be purged
			const cardsToPurge = await tx
				.select({ id: cards.id })
				.from(cards)
				.where(and(isNotNull(cards.deletedAt), lt(cards.deletedAt, cutoffDate)))
				.limit(batchSize);

			if (cardsToPurge.length > 0) {
				const cardIds = cardsToPurge.map((c) => c.id);
				const deletedReviewLogs = await tx
					.delete(reviewLogs)
					.where(inArray(reviewLogs.cardId, cardIds))
					.returning({ id: reviewLogs.id });
				result.reviewLogs = deletedReviewLogs.length;
			}

			// 2. Delete note_field_values for notes that will be purged
			const notesToPurge = await tx
				.select({ id: notes.id })
				.from(notes)
				.where(and(isNotNull(notes.deletedAt), lt(notes.deletedAt, cutoffDate)))
				.limit(batchSize);

			if (notesToPurge.length > 0) {
				const noteIds = notesToPurge.map((n) => n.id);
				const deletedNoteFieldValues = await tx
					.delete(noteFieldValues)
					.where(inArray(noteFieldValues.noteId, noteIds))
					.returning({ id: noteFieldValues.id });
				result.noteFieldValues = deletedNoteFieldValues.length;
			}

			// 3. Delete cards
			const deletedCards = await tx
				.delete(cards)
				.where(and(isNotNull(cards.deletedAt), lt(cards.deletedAt, cutoffDate)))
				.returning({ id: cards.id });
			result.cards = deletedCards.length;

			// 4. Delete notes
			const deletedNotes = await tx
				.delete(notes)
				.where(and(isNotNull(notes.deletedAt), lt(notes.deletedAt, cutoffDate)))
				.returning({ id: notes.id });
			result.notes = deletedNotes.length;

			// 5. Delete note_field_types for note_types that will be purged
			const noteTypesToPurge = await tx
				.select({ id: noteTypes.id })
				.from(noteTypes)
				.where(
					and(
						isNotNull(noteTypes.deletedAt),
						lt(noteTypes.deletedAt, cutoffDate),
					),
				)
				.limit(batchSize);

			if (noteTypesToPurge.length > 0) {
				const noteTypeIds = noteTypesToPurge.map((nt) => nt.id);
				const deletedNoteFieldTypes = await tx
					.delete(noteFieldTypes)
					.where(inArray(noteFieldTypes.noteTypeId, noteTypeIds))
					.returning({ id: noteFieldTypes.id });
				result.noteFieldTypes = deletedNoteFieldTypes.length;
			}

			// 6. Delete note_types
			const deletedNoteTypes = await tx
				.delete(noteTypes)
				.where(
					and(
						isNotNull(noteTypes.deletedAt),
						lt(noteTypes.deletedAt, cutoffDate),
					),
				)
				.returning({ id: noteTypes.id });
			result.noteTypes = deletedNoteTypes.length;

			// 7. Delete decks
			const deletedDecks = await tx
				.delete(decks)
				.where(and(isNotNull(decks.deletedAt), lt(decks.deletedAt, cutoffDate)))
				.returning({ id: decks.id });
			result.decks = deletedDecks.length;
		});

		return result;
	},
};
