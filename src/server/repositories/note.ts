import { and, eq, isNull, sql } from "drizzle-orm";
import { generateCardsForNote } from "../../shared/card-generator.js";
import { db } from "../db/index.js";
import {
	cards,
	noteFieldTypes,
	noteFieldValues,
	notes,
	noteTypes,
} from "../db/schema.js";
import type {
	BulkCreateNoteInput,
	BulkCreateNoteResult,
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
			.where(and(eq(notes.deckId, deckId), isNull(notes.deletedAt)))
			.orderBy(notes.createdAt);
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
			.where(eq(noteFieldValues.noteId, id))
			.orderBy(noteFieldValues.noteFieldTypeId);

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
		const generatedCards = generateCardsForNote({
			noteType: noteType[0],
			fieldTypes,
			fieldValues: fieldValuesResult,
		});

		for (const generated of generatedCards) {
			const card = await insertGeneratedCard(deckId, note.id, generated);
			createdCards.push(card);
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
			.where(eq(noteFieldValues.noteId, id))
			.orderBy(noteFieldValues.noteFieldTypeId);

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

	async createMany(
		deckId: string,
		notesInput: BulkCreateNoteInput[],
	): Promise<BulkCreateNoteResult> {
		const failed: { index: number; error: string }[] = [];
		let created = 0;

		// Pre-fetch all note types and their field types for validation
		const noteTypeCache = new Map<
			string,
			{
				noteType: {
					frontTemplate: string;
					backTemplate: string;
					isReversible: boolean;
				};
				fieldTypes: { id: string; name: string }[];
			}
		>();

		for (let i = 0; i < notesInput.length; i++) {
			const input = notesInput[i];
			if (!input) continue;

			try {
				// Get note type from cache or fetch
				let cached = noteTypeCache.get(input.noteTypeId);
				if (!cached) {
					const noteType = await db
						.select()
						.from(noteTypes)
						.where(
							and(
								eq(noteTypes.id, input.noteTypeId),
								isNull(noteTypes.deletedAt),
							),
						);

					if (!noteType[0]) {
						failed.push({ index: i, error: "Note type not found" });
						continue;
					}

					const fieldTypes = await db
						.select()
						.from(noteFieldTypes)
						.where(
							and(
								eq(noteFieldTypes.noteTypeId, input.noteTypeId),
								isNull(noteFieldTypes.deletedAt),
							),
						)
						.orderBy(noteFieldTypes.order);

					cached = { noteType: noteType[0], fieldTypes };
					noteTypeCache.set(input.noteTypeId, cached);
				}

				// Create note
				const [note] = await db
					.insert(notes)
					.values({
						deckId,
						noteTypeId: input.noteTypeId,
					})
					.returning();

				if (!note) {
					failed.push({ index: i, error: "Failed to create note" });
					continue;
				}

				// Create field values
				const fieldValuesResult: NoteFieldValue[] = [];
				for (const fieldType of cached.fieldTypes) {
					const value = input.fields[fieldType.id] ?? "";
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

				const generatedCards = generateCardsForNote({
					noteType: cached.noteType,
					fieldTypes: cached.fieldTypes,
					fieldValues: fieldValuesResult,
				});
				for (const generated of generatedCards) {
					await insertGeneratedCard(deckId, note.id, generated);
				}

				created++;
			} catch (error) {
				failed.push({
					index: i,
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}

		return { created, failed };
	},
};

async function insertGeneratedCard(
	deckId: string,
	noteId: string,
	generated: ReturnType<typeof generateCardsForNote>[number],
): Promise<Card> {
	const [card] = await db
		.insert(cards)
		.values({
			deckId,
			noteId,
			isReversed: generated.isReversed,
			front: generated.front,
			back: generated.back,
			state: generated.state,
			due: generated.due,
			stability: generated.stability,
			difficulty: generated.difficulty,
			elapsedDays: generated.elapsedDays,
			scheduledDays: generated.scheduledDays,
			reps: generated.reps,
			lapses: generated.lapses,
		})
		.returning();

	if (!card) {
		throw new Error("Failed to create card");
	}

	return card;
}
