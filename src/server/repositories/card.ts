import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { getEndOfStudyDayBoundary } from "../../shared/date.js";
import { db } from "../db/index.js";
import {
	CardState,
	cards,
	noteFieldTypes,
	noteFieldValues,
	notes,
	noteTypes,
} from "../db/schema.js";
import type {
	Card,
	CardForStudy,
	CardRepository,
	CardWithNoteData,
} from "./types.js";

export const cardRepository: CardRepository = {
	async findByDeckId(deckId: string): Promise<Card[]> {
		const result = await db
			.select()
			.from(cards)
			.where(and(eq(cards.deckId, deckId), isNull(cards.deletedAt)))
			.orderBy(cards.createdAt);
		return result;
	},

	async findById(id: string, deckId: string): Promise<Card | undefined> {
		const result = await db
			.select()
			.from(cards)
			.where(
				and(
					eq(cards.id, id),
					eq(cards.deckId, deckId),
					isNull(cards.deletedAt),
				),
			);
		return result[0];
	},

	async findByIdWithNoteData(
		id: string,
		deckId: string,
	): Promise<CardWithNoteData | undefined> {
		const card = await this.findById(id, deckId);
		if (!card) {
			return undefined;
		}

		const noteResult = await db
			.select()
			.from(notes)
			.where(and(eq(notes.id, card.noteId), isNull(notes.deletedAt)));

		const note = noteResult[0];
		if (!note) {
			return undefined;
		}

		const fieldValuesResult = await db
			.select()
			.from(noteFieldValues)
			.where(eq(noteFieldValues.noteId, card.noteId));

		return {
			...card,
			note,
			fieldValues: fieldValuesResult,
		};
	},

	async findByNoteId(noteId: string): Promise<Card[]> {
		const result = await db
			.select()
			.from(cards)
			.where(and(eq(cards.noteId, noteId), isNull(cards.deletedAt)))
			.orderBy(cards.isReversed);
		return result;
	},

	async create(
		deckId: string,
		data: {
			noteId: string;
			isReversed: boolean;
			front: string;
			back: string;
		},
	): Promise<Card> {
		const [card] = await db
			.insert(cards)
			.values({
				deckId,
				noteId: data.noteId,
				isReversed: data.isReversed,
				front: data.front,
				back: data.back,
				state: CardState.New,
				due: new Date(),
				stability: 0,
				difficulty: 0,
				elapsedDays: 0,
				scheduledDays: 0,
				reps: 0,
				lapses: 0,
			})
			.returning();
		if (!card) {
			throw new Error("Failed to create card");
		}
		return card;
	},

	async update(
		id: string,
		deckId: string,
		data: {
			front?: string;
			back?: string;
		},
	): Promise<Card | undefined> {
		const result = await db
			.update(cards)
			.set({
				...data,
				updatedAt: new Date(),
				syncVersion: sql`${cards.syncVersion} + 1`,
			})
			.where(
				and(
					eq(cards.id, id),
					eq(cards.deckId, deckId),
					isNull(cards.deletedAt),
				),
			)
			.returning();
		return result[0];
	},

	async softDelete(id: string, deckId: string): Promise<boolean> {
		// First, find the card to get its noteId
		const card = await this.findById(id, deckId);
		if (!card) {
			return false;
		}

		const now = new Date();

		// Soft delete all cards belonging to the same note (including this one and sibling cards)
		await db
			.update(cards)
			.set({
				deletedAt: now,
				updatedAt: now,
				syncVersion: sql`${cards.syncVersion} + 1`,
			})
			.where(and(eq(cards.noteId, card.noteId), isNull(cards.deletedAt)));

		// Soft delete the parent note
		await db
			.update(notes)
			.set({
				deletedAt: now,
				updatedAt: now,
				syncVersion: sql`${notes.syncVersion} + 1`,
			})
			.where(and(eq(notes.id, card.noteId), isNull(notes.deletedAt)));

		return true;
	},

	async softDeleteByNoteId(noteId: string): Promise<boolean> {
		const now = new Date();
		const result = await db
			.update(cards)
			.set({
				deletedAt: now,
				updatedAt: now,
				syncVersion: sql`${cards.syncVersion} + 1`,
			})
			.where(and(eq(cards.noteId, noteId), isNull(cards.deletedAt)))
			.returning({ id: cards.id });
		return result.length > 0;
	},

	async findDueCards(
		deckId: string,
		now: Date,
		limit: number,
	): Promise<Card[]> {
		const boundary = getEndOfStudyDayBoundary(now);
		const result = await db
			.select()
			.from(cards)
			.where(
				and(
					eq(cards.deckId, deckId),
					isNull(cards.deletedAt),
					lt(cards.due, boundary),
				),
			)
			.orderBy(cards.due)
			.limit(limit);
		return result;
	},

	async countDueCards(deckId: string, now: Date): Promise<number> {
		const boundary = getEndOfStudyDayBoundary(now);
		const result = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(cards)
			.where(
				and(
					eq(cards.deckId, deckId),
					isNull(cards.deletedAt),
					lt(cards.due, boundary),
				),
			);
		return result[0]?.count ?? 0;
	},

	async findDueCardsWithNoteData(
		deckId: string,
		now: Date,
		limit: number,
	): Promise<CardWithNoteData[]> {
		const dueCards = await this.findDueCards(deckId, now, limit);

		const cardsWithNoteData: CardWithNoteData[] = [];

		for (const card of dueCards) {
			const noteResult = await db
				.select()
				.from(notes)
				.where(and(eq(notes.id, card.noteId), isNull(notes.deletedAt)));

			const note = noteResult[0];
			if (!note) {
				// Note was deleted, skip this card
				continue;
			}

			const fieldValuesResult = await db
				.select()
				.from(noteFieldValues)
				.where(eq(noteFieldValues.noteId, card.noteId));

			cardsWithNoteData.push({
				...card,
				note,
				fieldValues: fieldValuesResult,
			});
		}

		return cardsWithNoteData;
	},

	async findDueCardsForStudy(
		deckId: string,
		now: Date,
		limit: number,
	): Promise<CardForStudy[]> {
		const dueCards = await this.findDueCards(deckId, now, limit);

		const cardsForStudy: CardForStudy[] = [];

		for (const card of dueCards) {
			// Fetch note to get noteTypeId
			const noteResult = await db
				.select()
				.from(notes)
				.where(and(eq(notes.id, card.noteId), isNull(notes.deletedAt)));

			const note = noteResult[0];
			if (!note) {
				// Note was deleted, skip this card
				continue;
			}

			// Fetch note type for templates
			const noteTypeResult = await db
				.select({
					frontTemplate: noteTypes.frontTemplate,
					backTemplate: noteTypes.backTemplate,
				})
				.from(noteTypes)
				.where(
					and(eq(noteTypes.id, note.noteTypeId), isNull(noteTypes.deletedAt)),
				);

			const noteType = noteTypeResult[0];
			if (!noteType) {
				// Note type was deleted, skip this card
				continue;
			}

			// Fetch field values with their field names
			const fieldValuesWithNames = await db
				.select({
					fieldName: noteFieldTypes.name,
					value: noteFieldValues.value,
				})
				.from(noteFieldValues)
				.innerJoin(
					noteFieldTypes,
					eq(noteFieldValues.noteFieldTypeId, noteFieldTypes.id),
				)
				.where(eq(noteFieldValues.noteId, card.noteId));

			// Convert to name-value map
			const fieldValuesMap: Record<string, string> = {};
			for (const fv of fieldValuesWithNames) {
				fieldValuesMap[fv.fieldName] = fv.value;
			}

			cardsForStudy.push({
				...card,
				noteType: {
					frontTemplate: noteType.frontTemplate,
					backTemplate: noteType.backTemplate,
				},
				fieldValuesMap,
			});
		}

		return cardsForStudy;
	},

	async updateFSRSFields(
		id: string,
		deckId: string,
		data: {
			state: number;
			due: Date;
			stability: number;
			difficulty: number;
			elapsedDays: number;
			scheduledDays: number;
			reps: number;
			lapses: number;
			lastReview: Date;
		},
	): Promise<Card | undefined> {
		const result = await db
			.update(cards)
			.set({
				state: data.state,
				due: data.due,
				stability: data.stability,
				difficulty: data.difficulty,
				elapsedDays: data.elapsedDays,
				scheduledDays: data.scheduledDays,
				reps: data.reps,
				lapses: data.lapses,
				lastReview: data.lastReview,
				updatedAt: new Date(),
				syncVersion: sql`${cards.syncVersion} + 1`,
			})
			.where(
				and(
					eq(cards.id, id),
					eq(cards.deckId, deckId),
					isNull(cards.deletedAt),
				),
			)
			.returning();
		return result[0];
	},
};
