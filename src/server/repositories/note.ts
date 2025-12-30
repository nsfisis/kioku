import { and, eq, isNull, sql } from "drizzle-orm";
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
	CreateNoteResult,
	Note,
	NoteFieldValue,
	NoteRepository,
	NoteWithFieldValues,
} from "./types.js";

export const noteRepository: NoteRepository = {
	async findByDeckId(deckId: string): Promise<Note[]> {
		const result = await db
			.select()
			.from(notes)
			.where(and(eq(notes.deckId, deckId), isNull(notes.deletedAt)));
		return result;
	},

	async findById(id: string, deckId: string): Promise<Note | undefined> {
		const result = await db
			.select()
			.from(notes)
			.where(
				and(
					eq(notes.id, id),
					eq(notes.deckId, deckId),
					isNull(notes.deletedAt),
				),
			);
		return result[0];
	},

	async findByIdWithFieldValues(
		id: string,
		deckId: string,
	): Promise<NoteWithFieldValues | undefined> {
		const note = await this.findById(id, deckId);
		if (!note) {
			return undefined;
		}

		const fieldValuesResult = await db
			.select()
			.from(noteFieldValues)
			.where(eq(noteFieldValues.noteId, id));

		return {
			...note,
			fieldValues: fieldValuesResult,
		};
	},

	async create(
		deckId: string,
		data: {
			noteTypeId: string;
			fields: Record<string, string>;
		},
	): Promise<CreateNoteResult> {
		const noteType = await db
			.select()
			.from(noteTypes)
			.where(
				and(eq(noteTypes.id, data.noteTypeId), isNull(noteTypes.deletedAt)),
			);

		if (!noteType[0]) {
			throw new Error("Note type not found");
		}

		const fieldTypes = await db
			.select()
			.from(noteFieldTypes)
			.where(
				and(
					eq(noteFieldTypes.noteTypeId, data.noteTypeId),
					isNull(noteFieldTypes.deletedAt),
				),
			)
			.orderBy(noteFieldTypes.order);

		const [note] = await db
			.insert(notes)
			.values({
				deckId,
				noteTypeId: data.noteTypeId,
			})
			.returning();

		if (!note) {
			throw new Error("Failed to create note");
		}

		const fieldValuesResult: NoteFieldValue[] = [];
		for (const fieldType of fieldTypes) {
			const value = data.fields[fieldType.id] ?? "";
			const [fieldValue] = await db
				.insert(noteFieldValues)
				.values({
					noteId: note.id,
					noteFieldTypeId: fieldType.id,
					value,
				})
				.returning();
			if (fieldValue) {
				fieldValuesResult.push(fieldValue);
			}
		}

		const createdCards: Card[] = [];

		const normalCard = await createCardForNote(
			deckId,
			note.id,
			noteType[0],
			fieldValuesResult,
			fieldTypes,
			false,
		);
		createdCards.push(normalCard);

		if (noteType[0].isReversible) {
			const reversedCard = await createCardForNote(
				deckId,
				note.id,
				noteType[0],
				fieldValuesResult,
				fieldTypes,
				true,
			);
			createdCards.push(reversedCard);
		}

		return {
			note,
			fieldValues: fieldValuesResult,
			cards: createdCards,
		};
	},

	async update(
		id: string,
		deckId: string,
		fields: Record<string, string>,
	): Promise<NoteWithFieldValues | undefined> {
		const note = await this.findById(id, deckId);
		if (!note) {
			return undefined;
		}

		const [updatedNote] = await db
			.update(notes)
			.set({
				updatedAt: new Date(),
				syncVersion: sql`${notes.syncVersion} + 1`,
			})
			.where(and(eq(notes.id, id), eq(notes.deckId, deckId)))
			.returning();

		if (!updatedNote) {
			return undefined;
		}

		const updatedFieldValues: NoteFieldValue[] = [];
		for (const [fieldTypeId, value] of Object.entries(fields)) {
			const existingFieldValue = await db
				.select()
				.from(noteFieldValues)
				.where(
					and(
						eq(noteFieldValues.noteId, id),
						eq(noteFieldValues.noteFieldTypeId, fieldTypeId),
					),
				);

			if (existingFieldValue[0]) {
				const [updated] = await db
					.update(noteFieldValues)
					.set({
						value,
						updatedAt: new Date(),
						syncVersion: sql`${noteFieldValues.syncVersion} + 1`,
					})
					.where(
						and(
							eq(noteFieldValues.noteId, id),
							eq(noteFieldValues.noteFieldTypeId, fieldTypeId),
						),
					)
					.returning();
				if (updated) {
					updatedFieldValues.push(updated);
				}
			} else {
				const [created] = await db
					.insert(noteFieldValues)
					.values({
						noteId: id,
						noteFieldTypeId: fieldTypeId,
						value,
					})
					.returning();
				if (created) {
					updatedFieldValues.push(created);
				}
			}
		}

		const allFieldValues = await db
			.select()
			.from(noteFieldValues)
			.where(eq(noteFieldValues.noteId, id));

		return {
			...updatedNote,
			fieldValues: allFieldValues,
		};
	},

	async softDelete(id: string, deckId: string): Promise<boolean> {
		const note = await this.findById(id, deckId);
		if (!note) {
			return false;
		}

		const now = new Date();

		await db
			.update(cards)
			.set({
				deletedAt: now,
				updatedAt: now,
				syncVersion: sql`${cards.syncVersion} + 1`,
			})
			.where(and(eq(cards.noteId, id), isNull(cards.deletedAt)));

		const result = await db
			.update(notes)
			.set({
				deletedAt: now,
				updatedAt: now,
				syncVersion: sql`${notes.syncVersion} + 1`,
			})
			.where(
				and(
					eq(notes.id, id),
					eq(notes.deckId, deckId),
					isNull(notes.deletedAt),
				),
			)
			.returning({ id: notes.id });

		return result.length > 0;
	},
};

async function createCardForNote(
	deckId: string,
	noteId: string,
	noteType: { frontTemplate: string; backTemplate: string },
	fieldValues: NoteFieldValue[],
	fieldTypes: { id: string; name: string }[],
	isReversed: boolean,
): Promise<Card> {
	const fieldMap = new Map<string, string>();
	for (const fv of fieldValues) {
		const fieldType = fieldTypes.find((ft) => ft.id === fv.noteFieldTypeId);
		if (fieldType) {
			fieldMap.set(fieldType.name, fv.value);
		}
	}

	const frontTemplate = isReversed
		? noteType.backTemplate
		: noteType.frontTemplate;
	const backTemplate = isReversed
		? noteType.frontTemplate
		: noteType.backTemplate;

	const front = renderTemplate(frontTemplate, fieldMap);
	const back = renderTemplate(backTemplate, fieldMap);

	const [card] = await db
		.insert(cards)
		.values({
			deckId,
			noteId,
			isReversed,
			front,
			back,
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
}

function renderTemplate(template: string, fields: Map<string, string>): string {
	let result = template;
	for (const [name, value] of fields) {
		result = result.replace(new RegExp(`\\{\\{${name}\\}\\}`, "g"), value);
	}
	return result;
}
