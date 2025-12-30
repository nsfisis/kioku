import { describe, expect, it } from "vitest";
import {
	createNoteFieldTypeSchema,
	createNoteSchema,
	createNoteTypeSchema,
	noteFieldTypeSchema,
	noteFieldValueSchema,
	noteSchema,
	noteTypeSchema,
	updateNoteFieldTypeSchema,
	updateNoteSchema,
	updateNoteTypeSchema,
} from "./index";

describe("NoteType schemas", () => {
	describe("noteTypeSchema", () => {
		const validNoteType = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			userId: "550e8400-e29b-41d4-a716-446655440001",
			name: "Basic",
			frontTemplate: "{{Front}}",
			backTemplate: "{{Back}}",
			isReversible: false,
			createdAt: new Date("2024-01-01"),
			updatedAt: new Date("2024-01-01"),
			deletedAt: null,
			syncVersion: 0,
		};

		it("should parse valid note type", () => {
			const result = noteTypeSchema.safeParse(validNoteType);
			expect(result.success).toBe(true);
		});

		it("should parse date strings", () => {
			const result = noteTypeSchema.safeParse({
				...validNoteType,
				createdAt: "2024-01-01T00:00:00.000Z",
				updatedAt: "2024-01-01T00:00:00.000Z",
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.createdAt).toBeInstanceOf(Date);
				expect(result.data.updatedAt).toBeInstanceOf(Date);
			}
		});

		it("should reject invalid UUID for id", () => {
			const result = noteTypeSchema.safeParse({
				...validNoteType,
				id: "not-a-uuid",
			});
			expect(result.success).toBe(false);
		});

		it("should reject empty name", () => {
			const result = noteTypeSchema.safeParse({
				...validNoteType,
				name: "",
			});
			expect(result.success).toBe(false);
		});

		it("should reject name longer than 255 characters", () => {
			const result = noteTypeSchema.safeParse({
				...validNoteType,
				name: "a".repeat(256),
			});
			expect(result.success).toBe(false);
		});

		it("should reject empty frontTemplate", () => {
			const result = noteTypeSchema.safeParse({
				...validNoteType,
				frontTemplate: "",
			});
			expect(result.success).toBe(false);
		});

		it("should reject empty backTemplate", () => {
			const result = noteTypeSchema.safeParse({
				...validNoteType,
				backTemplate: "",
			});
			expect(result.success).toBe(false);
		});

		it("should reject negative syncVersion", () => {
			const result = noteTypeSchema.safeParse({
				...validNoteType,
				syncVersion: -1,
			});
			expect(result.success).toBe(false);
		});

		it("should accept deletedAt as date", () => {
			const result = noteTypeSchema.safeParse({
				...validNoteType,
				deletedAt: new Date("2024-01-02"),
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.deletedAt).toBeInstanceOf(Date);
			}
		});
	});

	describe("createNoteTypeSchema", () => {
		it("should parse valid create input", () => {
			const result = createNoteTypeSchema.safeParse({
				name: "Basic",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: true,
			});
			expect(result.success).toBe(true);
		});

		it("should default isReversible to false", () => {
			const result = createNoteTypeSchema.safeParse({
				name: "Basic",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.isReversible).toBe(false);
			}
		});

		it("should reject missing name", () => {
			const result = createNoteTypeSchema.safeParse({
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
			});
			expect(result.success).toBe(false);
		});

		it("should reject missing frontTemplate", () => {
			const result = createNoteTypeSchema.safeParse({
				name: "Basic",
				backTemplate: "{{Back}}",
			});
			expect(result.success).toBe(false);
		});

		it("should reject missing backTemplate", () => {
			const result = createNoteTypeSchema.safeParse({
				name: "Basic",
				frontTemplate: "{{Front}}",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("updateNoteTypeSchema", () => {
		it("should parse with all optional fields", () => {
			const result = updateNoteTypeSchema.safeParse({});
			expect(result.success).toBe(true);
		});

		it("should parse with partial fields", () => {
			const result = updateNoteTypeSchema.safeParse({
				name: "Updated Name",
			});
			expect(result.success).toBe(true);
		});

		it("should parse with all fields", () => {
			const result = updateNoteTypeSchema.safeParse({
				name: "Updated Name",
				frontTemplate: "{{NewFront}}",
				backTemplate: "{{NewBack}}",
				isReversible: true,
			});
			expect(result.success).toBe(true);
		});

		it("should reject empty name if provided", () => {
			const result = updateNoteTypeSchema.safeParse({
				name: "",
			});
			expect(result.success).toBe(false);
		});
	});
});

describe("NoteFieldType schemas", () => {
	describe("noteFieldTypeSchema", () => {
		const validNoteFieldType = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			noteTypeId: "550e8400-e29b-41d4-a716-446655440001",
			name: "Front",
			order: 0,
			fieldType: "text" as const,
			createdAt: new Date("2024-01-01"),
			updatedAt: new Date("2024-01-01"),
			deletedAt: null,
			syncVersion: 0,
		};

		it("should parse valid note field type", () => {
			const result = noteFieldTypeSchema.safeParse(validNoteFieldType);
			expect(result.success).toBe(true);
		});

		it("should reject invalid fieldType", () => {
			const result = noteFieldTypeSchema.safeParse({
				...validNoteFieldType,
				fieldType: "invalid",
			});
			expect(result.success).toBe(false);
		});

		it("should reject negative order", () => {
			const result = noteFieldTypeSchema.safeParse({
				...validNoteFieldType,
				order: -1,
			});
			expect(result.success).toBe(false);
		});

		it("should reject empty name", () => {
			const result = noteFieldTypeSchema.safeParse({
				...validNoteFieldType,
				name: "",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("createNoteFieldTypeSchema", () => {
		it("should parse valid create input", () => {
			const result = createNoteFieldTypeSchema.safeParse({
				name: "Front",
				order: 0,
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.fieldType).toBe("text");
			}
		});

		it("should accept explicit fieldType", () => {
			const result = createNoteFieldTypeSchema.safeParse({
				name: "Front",
				order: 0,
				fieldType: "text",
			});
			expect(result.success).toBe(true);
		});

		it("should reject missing name", () => {
			const result = createNoteFieldTypeSchema.safeParse({
				order: 0,
			});
			expect(result.success).toBe(false);
		});

		it("should reject missing order", () => {
			const result = createNoteFieldTypeSchema.safeParse({
				name: "Front",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("updateNoteFieldTypeSchema", () => {
		it("should parse with all optional fields", () => {
			const result = updateNoteFieldTypeSchema.safeParse({});
			expect(result.success).toBe(true);
		});

		it("should parse with name only", () => {
			const result = updateNoteFieldTypeSchema.safeParse({
				name: "Updated Field",
			});
			expect(result.success).toBe(true);
		});

		it("should parse with order only", () => {
			const result = updateNoteFieldTypeSchema.safeParse({
				order: 1,
			});
			expect(result.success).toBe(true);
		});
	});
});

describe("Note schemas", () => {
	describe("noteSchema", () => {
		const validNote = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			deckId: "550e8400-e29b-41d4-a716-446655440001",
			noteTypeId: "550e8400-e29b-41d4-a716-446655440002",
			createdAt: new Date("2024-01-01"),
			updatedAt: new Date("2024-01-01"),
			deletedAt: null,
			syncVersion: 0,
		};

		it("should parse valid note", () => {
			const result = noteSchema.safeParse(validNote);
			expect(result.success).toBe(true);
		});

		it("should reject invalid deckId", () => {
			const result = noteSchema.safeParse({
				...validNote,
				deckId: "not-a-uuid",
			});
			expect(result.success).toBe(false);
		});

		it("should reject invalid noteTypeId", () => {
			const result = noteSchema.safeParse({
				...validNote,
				noteTypeId: "not-a-uuid",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("createNoteSchema", () => {
		it("should parse valid create input", () => {
			const result = createNoteSchema.safeParse({
				noteTypeId: "550e8400-e29b-41d4-a716-446655440000",
				fields: {
					"550e8400-e29b-41d4-a716-446655440001": "Front content",
					"550e8400-e29b-41d4-a716-446655440002": "Back content",
				},
			});
			expect(result.success).toBe(true);
		});

		it("should accept empty fields", () => {
			const result = createNoteSchema.safeParse({
				noteTypeId: "550e8400-e29b-41d4-a716-446655440000",
				fields: {},
			});
			expect(result.success).toBe(true);
		});

		it("should reject missing noteTypeId", () => {
			const result = createNoteSchema.safeParse({
				fields: {},
			});
			expect(result.success).toBe(false);
		});

		it("should reject missing fields", () => {
			const result = createNoteSchema.safeParse({
				noteTypeId: "550e8400-e29b-41d4-a716-446655440000",
			});
			expect(result.success).toBe(false);
		});

		it("should reject invalid UUID in fields key", () => {
			const result = createNoteSchema.safeParse({
				noteTypeId: "550e8400-e29b-41d4-a716-446655440000",
				fields: {
					"not-a-uuid": "content",
				},
			});
			expect(result.success).toBe(false);
		});
	});

	describe("updateNoteSchema", () => {
		it("should parse valid update input", () => {
			const result = updateNoteSchema.safeParse({
				fields: {
					"550e8400-e29b-41d4-a716-446655440001": "Updated content",
				},
			});
			expect(result.success).toBe(true);
		});

		it("should reject missing fields", () => {
			const result = updateNoteSchema.safeParse({});
			expect(result.success).toBe(false);
		});
	});
});

describe("NoteFieldValue schemas", () => {
	describe("noteFieldValueSchema", () => {
		const validNoteFieldValue = {
			id: "550e8400-e29b-41d4-a716-446655440000",
			noteId: "550e8400-e29b-41d4-a716-446655440001",
			noteFieldTypeId: "550e8400-e29b-41d4-a716-446655440002",
			value: "Some content",
			createdAt: new Date("2024-01-01"),
			updatedAt: new Date("2024-01-01"),
			syncVersion: 0,
		};

		it("should parse valid note field value", () => {
			const result = noteFieldValueSchema.safeParse(validNoteFieldValue);
			expect(result.success).toBe(true);
		});

		it("should accept empty value", () => {
			const result = noteFieldValueSchema.safeParse({
				...validNoteFieldValue,
				value: "",
			});
			expect(result.success).toBe(true);
		});

		it("should reject invalid noteId", () => {
			const result = noteFieldValueSchema.safeParse({
				...validNoteFieldValue,
				noteId: "not-a-uuid",
			});
			expect(result.success).toBe(false);
		});

		it("should reject invalid noteFieldTypeId", () => {
			const result = noteFieldValueSchema.safeParse({
				...validNoteFieldValue,
				noteFieldTypeId: "not-a-uuid",
			});
			expect(result.success).toBe(false);
		});
	});
});
