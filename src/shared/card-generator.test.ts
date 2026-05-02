import { describe, expect, it } from "vitest";
import { generateCardsForNote, renderCardTemplate } from "./card-generator";

describe("renderCardTemplate", () => {
	it("substitutes a single placeholder", () => {
		const fields = new Map([["Front", "Hello"]]);
		expect(renderCardTemplate("{{Front}}", fields)).toBe("Hello");
	});

	it("substitutes multiple placeholders", () => {
		const fields = new Map([
			["Front", "Q"],
			["Back", "A"],
		]);
		expect(renderCardTemplate("{{Front}} -> {{Back}}", fields)).toBe("Q -> A");
	});

	it("substitutes the same placeholder repeated in a template", () => {
		const fields = new Map([["Word", "x"]]);
		expect(renderCardTemplate("{{Word}}{{Word}}", fields)).toBe("xx");
	});

	it("leaves unknown placeholders unchanged", () => {
		const fields = new Map([["Front", "Q"]]);
		expect(renderCardTemplate("{{Front}} {{Missing}}", fields)).toBe(
			"Q {{Missing}}",
		);
	});

	it("replaces placeholders with empty strings when value is empty", () => {
		const fields = new Map([["Front", ""]]);
		expect(renderCardTemplate("[{{Front}}]", fields)).toBe("[]");
	});
});

const noteTypeBase = {
	frontTemplate: "{{Front}}",
	backTemplate: "{{Back}}",
	isReversible: false,
};

const fieldTypes = [
	{ id: "ft-front", name: "Front" },
	{ id: "ft-back", name: "Back" },
];

const fieldValues = [
	{ noteFieldTypeId: "ft-front", value: "Question" },
	{ noteFieldTypeId: "ft-back", value: "Answer" },
];

describe("generateCardsForNote", () => {
	it("returns one card when isReversible is false", () => {
		const cards = generateCardsForNote({
			noteType: noteTypeBase,
			fieldTypes,
			fieldValues,
		});

		expect(cards).toHaveLength(1);
		expect(cards[0]).toMatchObject({
			isReversed: false,
			front: "Question",
			back: "Answer",
		});
	});

	it("returns two cards when isReversible is true and swaps templates", () => {
		const cards = generateCardsForNote({
			noteType: { ...noteTypeBase, isReversible: true },
			fieldTypes,
			fieldValues,
		});

		expect(cards).toHaveLength(2);
		expect(cards[0]).toMatchObject({
			isReversed: false,
			front: "Question",
			back: "Answer",
		});
		expect(cards[1]).toMatchObject({
			isReversed: true,
			front: "Answer",
			back: "Question",
		});
	});

	it("initialises FSRS state to a fresh new-card payload", () => {
		const now = new Date("2026-05-02T10:00:00Z");
		const [card] = generateCardsForNote({
			noteType: noteTypeBase,
			fieldTypes,
			fieldValues,
			now,
		});

		expect(card).toMatchObject({
			state: 0,
			stability: 0,
			difficulty: 0,
			elapsedDays: 0,
			scheduledDays: 0,
			reps: 0,
			lapses: 0,
		});
		expect(card?.due.getTime()).toBe(now.getTime());
	});

	it("treats missing field values as empty strings", () => {
		const [card] = generateCardsForNote({
			noteType: noteTypeBase,
			fieldTypes,
			fieldValues: [{ noteFieldTypeId: "ft-front", value: "Q only" }],
		});

		expect(card?.front).toBe("Q only");
		expect(card?.back).toBe("{{Back}}");
	});

	it("ignores field values with unknown field type ids", () => {
		const [card] = generateCardsForNote({
			noteType: noteTypeBase,
			fieldTypes,
			fieldValues: [
				...fieldValues,
				{ noteFieldTypeId: "ft-unknown", value: "ghost" },
			],
		});

		expect(card?.front).toBe("Question");
		expect(card?.back).toBe("Answer");
	});

	it("returns independent due Date instances per card", () => {
		const now = new Date("2026-05-02T10:00:00Z");
		const cards = generateCardsForNote({
			noteType: { ...noteTypeBase, isReversible: true },
			fieldTypes,
			fieldValues,
			now,
		});

		expect(cards[0]?.due).not.toBe(cards[1]?.due);
		expect(cards[0]?.due).not.toBe(now);
	});
});
