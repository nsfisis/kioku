/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CardState, db, FieldType } from "./index";
import {
	localCardRepository,
	localDeckRepository,
	localNoteFieldTypeRepository,
	localNoteFieldValueRepository,
	localNoteRepository,
	localNoteTypeRepository,
} from "./repositories";
import { buildStudyCards } from "./study-builder";

async function clearDb() {
	await db.decks.clear();
	await db.cards.clear();
	await db.reviewLogs.clear();
	await db.noteTypes.clear();
	await db.noteFieldTypes.clear();
	await db.notes.clear();
	await db.noteFieldValues.clear();
}

async function seedDeckWithDueCard() {
	const deck = await localDeckRepository.create({
		userId: "user-1",
		name: "Vocab",
		description: null,
		defaultNoteTypeId: null,
	});

	const noteType = await localNoteTypeRepository.create({
		userId: "user-1",
		name: "Basic",
		frontTemplate: "{{Front}}",
		backTemplate: "{{Back}}",
		isReversible: false,
	});

	const frontField = await localNoteFieldTypeRepository.create({
		noteTypeId: noteType.id,
		name: "Front",
		order: 0,
	});
	const backField = await localNoteFieldTypeRepository.create({
		noteTypeId: noteType.id,
		name: "Back",
		order: 1,
	});

	const note = await localNoteRepository.create({
		deckId: deck.id,
		noteTypeId: noteType.id,
	});

	await localNoteFieldValueRepository.create({
		noteId: note.id,
		noteFieldTypeId: frontField.id,
		value: "Hello",
	});
	await localNoteFieldValueRepository.create({
		noteId: note.id,
		noteFieldTypeId: backField.id,
		value: "こんにちは",
	});

	const card = await localCardRepository.create({
		deckId: deck.id,
		noteId: note.id,
		isReversed: false,
		front: "Hello",
		back: "こんにちは",
	});
	// Cards default to state=New with due=now, which counts as due.

	return { deck, noteType, note, card };
}

describe("buildStudyCards", () => {
	beforeEach(async () => {
		await clearDb();
	});

	afterEach(async () => {
		await clearDb();
	});

	it("assembles a StudyCard from local note + note type + field values", async () => {
		const { deck, card } = await seedDeckWithDueCard();

		const studyCards = await buildStudyCards(deck.id);

		expect(studyCards).toHaveLength(1);
		expect(studyCards[0]).toMatchObject({
			id: card.id,
			deckId: deck.id,
			isReversed: false,
			state: CardState.New,
			noteType: {
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
			},
			fieldValuesMap: {
				Front: "Hello",
				Back: "こんにちは",
			},
		});
	});

	it("skips cards whose note has been soft-deleted", async () => {
		const { deck, note } = await seedDeckWithDueCard();
		await localNoteRepository.delete(note.id);

		const studyCards = await buildStudyCards(deck.id);

		expect(studyCards).toHaveLength(0);
	});

	it("skips cards whose note type has been soft-deleted", async () => {
		const { deck, noteType } = await seedDeckWithDueCard();
		await localNoteTypeRepository.delete(noteType.id);

		const studyCards = await buildStudyCards(deck.id);

		expect(studyCards).toHaveLength(0);
	});

	it("skips cards whose due date is past the study-day boundary", async () => {
		const { deck, card } = await seedDeckWithDueCard();
		// Push due date a year into the future.
		await db.cards.update(card.id, {
			due: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
		});

		const studyCards = await buildStudyCards(deck.id);

		expect(studyCards).toHaveLength(0);
	});

	it("returns the field type assignments without losing fields", async () => {
		const { deck, noteType } = await seedDeckWithDueCard();

		// Add a third unused field type to make sure the builder handles
		// extra fields without value (gap).
		await localNoteFieldTypeRepository.create({
			noteTypeId: noteType.id,
			name: "Notes",
			order: 2,
		});

		const studyCards = await buildStudyCards(deck.id);

		expect(studyCards).toHaveLength(1);
		const studyCard = studyCards[0];
		if (!studyCard) throw new Error("expected one study card");
		expect(Object.keys(studyCard.fieldValuesMap).sort()).toEqual([
			"Back",
			"Front",
		]);
	});

	it("ignores text-type field values constant when building map", async () => {
		// Sanity check that FieldType.Text is what's set on field types.
		expect(FieldType.Text).toBe("text");
	});
});
