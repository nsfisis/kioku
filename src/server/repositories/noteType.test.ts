import { describe, expect, it, vi } from "vitest";
import type {
	NoteFieldType,
	NoteFieldTypeRepository,
	NoteType,
	NoteTypeRepository,
	NoteTypeWithFields,
} from "./types.js";

function createMockNoteType(overrides: Partial<NoteType> = {}): NoteType {
	return {
		id: "note-type-uuid-123",
		userId: "user-uuid-123",
		name: "Basic",
		frontTemplate: "{{Front}}",
		backTemplate: "{{Back}}",
		isReversible: false,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		deletedAt: null,
		syncVersion: 0,
		...overrides,
	};
}

function createMockNoteFieldType(
	overrides: Partial<NoteFieldType> = {},
): NoteFieldType {
	return {
		id: "field-type-uuid-123",
		noteTypeId: "note-type-uuid-123",
		name: "Front",
		order: 0,
		fieldType: "text",
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		deletedAt: null,
		syncVersion: 0,
		...overrides,
	};
}

function createMockNoteTypeWithFields(
	overrides: Partial<NoteTypeWithFields> = {},
): NoteTypeWithFields {
	const noteType = createMockNoteType(overrides);
	return {
		...noteType,
		fields: overrides.fields ?? [
			createMockNoteFieldType({ name: "Front", order: 0 }),
			createMockNoteFieldType({
				id: "field-type-uuid-456",
				name: "Back",
				order: 1,
			}),
		],
	};
}

function createMockNoteTypeRepo(): NoteTypeRepository {
	return {
		findByUserId: vi.fn(),
		findById: vi.fn(),
		findByIdWithFields: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		softDelete: vi.fn(),
		hasNotes: vi.fn(),
	};
}

function createMockNoteFieldTypeRepo(): NoteFieldTypeRepository {
	return {
		findByNoteTypeId: vi.fn(),
		findById: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		softDelete: vi.fn(),
		reorder: vi.fn(),
		hasNoteFieldValues: vi.fn(),
	};
}

describe("NoteTypeRepository mock factory", () => {
	describe("createMockNoteType", () => {
		it("creates a valid NoteType with defaults", () => {
			const noteType = createMockNoteType();

			expect(noteType.id).toBe("note-type-uuid-123");
			expect(noteType.userId).toBe("user-uuid-123");
			expect(noteType.name).toBe("Basic");
			expect(noteType.frontTemplate).toBe("{{Front}}");
			expect(noteType.backTemplate).toBe("{{Back}}");
			expect(noteType.isReversible).toBe(false);
			expect(noteType.deletedAt).toBeNull();
			expect(noteType.syncVersion).toBe(0);
		});

		it("allows overriding properties", () => {
			const noteType = createMockNoteType({
				id: "custom-id",
				name: "Basic (and reversed)",
				isReversible: true,
			});

			expect(noteType.id).toBe("custom-id");
			expect(noteType.name).toBe("Basic (and reversed)");
			expect(noteType.isReversible).toBe(true);
			expect(noteType.userId).toBe("user-uuid-123");
		});
	});

	describe("createMockNoteFieldType", () => {
		it("creates a valid NoteFieldType with defaults", () => {
			const fieldType = createMockNoteFieldType();

			expect(fieldType.id).toBe("field-type-uuid-123");
			expect(fieldType.noteTypeId).toBe("note-type-uuid-123");
			expect(fieldType.name).toBe("Front");
			expect(fieldType.order).toBe(0);
			expect(fieldType.fieldType).toBe("text");
			expect(fieldType.deletedAt).toBeNull();
		});

		it("allows overriding properties", () => {
			const fieldType = createMockNoteFieldType({
				name: "Back",
				order: 1,
			});

			expect(fieldType.name).toBe("Back");
			expect(fieldType.order).toBe(1);
		});
	});

	describe("createMockNoteTypeWithFields", () => {
		it("creates NoteType with default fields", () => {
			const noteTypeWithFields = createMockNoteTypeWithFields();

			expect(noteTypeWithFields.fields).toHaveLength(2);
			expect(noteTypeWithFields.fields[0]?.name).toBe("Front");
			expect(noteTypeWithFields.fields[1]?.name).toBe("Back");
		});

		it("allows overriding fields", () => {
			const customFields = [
				createMockNoteFieldType({ name: "Word", order: 0 }),
				createMockNoteFieldType({ name: "Reading", order: 1 }),
				createMockNoteFieldType({ name: "Meaning", order: 2 }),
			];
			const noteTypeWithFields = createMockNoteTypeWithFields({
				name: "Japanese Vocabulary",
				fields: customFields,
			});

			expect(noteTypeWithFields.name).toBe("Japanese Vocabulary");
			expect(noteTypeWithFields.fields).toHaveLength(3);
			expect(noteTypeWithFields.fields[2]?.name).toBe("Meaning");
		});
	});

	describe("createMockNoteTypeRepo", () => {
		it("creates a repository with all required methods", () => {
			const repo = createMockNoteTypeRepo();

			expect(repo.findByUserId).toBeDefined();
			expect(repo.findById).toBeDefined();
			expect(repo.findByIdWithFields).toBeDefined();
			expect(repo.create).toBeDefined();
			expect(repo.update).toBeDefined();
			expect(repo.softDelete).toBeDefined();
			expect(repo.hasNotes).toBeDefined();
		});

		it("methods are mockable", async () => {
			const repo = createMockNoteTypeRepo();
			const mockNoteType = createMockNoteType();

			vi.mocked(repo.findByUserId).mockResolvedValue([mockNoteType]);
			vi.mocked(repo.findById).mockResolvedValue(mockNoteType);
			vi.mocked(repo.create).mockResolvedValue(mockNoteType);
			vi.mocked(repo.hasNotes).mockResolvedValue(false);

			const results = await repo.findByUserId("user-123");
			expect(results).toHaveLength(1);
			expect(repo.findByUserId).toHaveBeenCalledWith("user-123");

			const found = await repo.findById("note-type-id", "user-123");
			expect(found).toEqual(mockNoteType);

			const created = await repo.create({
				userId: "user-123",
				name: "Test",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
			});
			expect(created.name).toBe("Basic");

			const hasNotes = await repo.hasNotes("note-type-id", "user-123");
			expect(hasNotes).toBe(false);
		});
	});

	describe("createMockNoteFieldTypeRepo", () => {
		it("creates a repository with all required methods", () => {
			const repo = createMockNoteFieldTypeRepo();

			expect(repo.findByNoteTypeId).toBeDefined();
			expect(repo.findById).toBeDefined();
			expect(repo.create).toBeDefined();
			expect(repo.update).toBeDefined();
			expect(repo.softDelete).toBeDefined();
			expect(repo.reorder).toBeDefined();
			expect(repo.hasNoteFieldValues).toBeDefined();
		});

		it("methods are mockable", async () => {
			const repo = createMockNoteFieldTypeRepo();
			const mockFields = [
				createMockNoteFieldType({ name: "Front", order: 0 }),
				createMockNoteFieldType({ name: "Back", order: 1 }),
			];

			vi.mocked(repo.findByNoteTypeId).mockResolvedValue(mockFields);
			vi.mocked(repo.reorder).mockResolvedValue(mockFields.reverse());
			vi.mocked(repo.hasNoteFieldValues).mockResolvedValue(true);

			const fields = await repo.findByNoteTypeId("note-type-id");
			expect(fields).toHaveLength(2);

			const reordered = await repo.reorder("note-type-id", [
				"field-2",
				"field-1",
			]);
			expect(reordered[0]?.name).toBe("Back");

			const hasValues = await repo.hasNoteFieldValues("field-id");
			expect(hasValues).toBe(true);
		});
	});
});

describe("NoteType interface contracts", () => {
	it("NoteType has required FSRS sync fields", () => {
		const noteType = createMockNoteType();

		expect(noteType).toHaveProperty("syncVersion");
		expect(noteType).toHaveProperty("createdAt");
		expect(noteType).toHaveProperty("updatedAt");
		expect(noteType).toHaveProperty("deletedAt");
	});

	it("NoteFieldType has required sync fields", () => {
		const fieldType = createMockNoteFieldType();

		expect(fieldType).toHaveProperty("syncVersion");
		expect(fieldType).toHaveProperty("createdAt");
		expect(fieldType).toHaveProperty("updatedAt");
		expect(fieldType).toHaveProperty("deletedAt");
	});

	it("NoteTypeWithFields extends NoteType with fields array", () => {
		const noteTypeWithFields = createMockNoteTypeWithFields();

		expect(noteTypeWithFields).toHaveProperty("id");
		expect(noteTypeWithFields).toHaveProperty("userId");
		expect(noteTypeWithFields).toHaveProperty("name");
		expect(noteTypeWithFields).toHaveProperty("fields");
		expect(Array.isArray(noteTypeWithFields.fields)).toBe(true);
	});
});

describe("NoteType deletion constraints", () => {
	describe("NoteType cannot be deleted if Notes exist", () => {
		it("hasNotes returns true when notes reference the note type", async () => {
			// This test documents the expected behavior:
			// NoteType deletion should be blocked if any Notes use it
			const repo = createMockNoteTypeRepo();

			vi.mocked(repo.hasNotes).mockResolvedValue(true);

			const hasNotes = await repo.hasNotes("note-type-with-notes", "user-id");
			expect(hasNotes).toBe(true);
		});

		it("hasNotes returns false when no notes reference the note type", async () => {
			const repo = createMockNoteTypeRepo();

			vi.mocked(repo.hasNotes).mockResolvedValue(false);

			const hasNotes = await repo.hasNotes(
				"note-type-without-notes",
				"user-id",
			);
			expect(hasNotes).toBe(false);
		});

		it("softDelete should only proceed if hasNotes returns false", async () => {
			// This documents the expected flow in the route handler:
			// 1. Call hasNotes to check if notes exist
			// 2. If true, return 409 Conflict
			// 3. If false, proceed with softDelete
			const repo = createMockNoteTypeRepo();

			vi.mocked(repo.hasNotes).mockResolvedValue(false);
			vi.mocked(repo.softDelete).mockResolvedValue(true);

			const hasNotes = await repo.hasNotes("note-type-id", "user-id");
			expect(hasNotes).toBe(false);

			const deleted = await repo.softDelete("note-type-id", "user-id");
			expect(deleted).toBe(true);
		});
	});
});

describe("NoteFieldType deletion constraints", () => {
	describe("NoteFieldType cannot be deleted if NoteFieldValues exist", () => {
		it("hasNoteFieldValues returns true when field values reference the field type", async () => {
			// This test documents the expected behavior:
			// NoteFieldType deletion should be blocked if any NoteFieldValues use it
			const repo = createMockNoteFieldTypeRepo();

			vi.mocked(repo.hasNoteFieldValues).mockResolvedValue(true);

			const hasValues = await repo.hasNoteFieldValues("field-type-with-values");
			expect(hasValues).toBe(true);
		});

		it("hasNoteFieldValues returns false when no field values reference the field type", async () => {
			const repo = createMockNoteFieldTypeRepo();

			vi.mocked(repo.hasNoteFieldValues).mockResolvedValue(false);

			const hasValues = await repo.hasNoteFieldValues(
				"field-type-without-values",
			);
			expect(hasValues).toBe(false);
		});

		it("softDelete should only proceed if hasNoteFieldValues returns false", async () => {
			// This documents the expected flow in the route handler:
			// 1. Call hasNoteFieldValues to check if values exist
			// 2. If true, return 409 Conflict
			// 3. If false, proceed with softDelete
			const repo = createMockNoteFieldTypeRepo();

			vi.mocked(repo.hasNoteFieldValues).mockResolvedValue(false);
			vi.mocked(repo.softDelete).mockResolvedValue(true);

			const hasValues = await repo.hasNoteFieldValues("field-type-id");
			expect(hasValues).toBe(false);

			const deleted = await repo.softDelete("field-type-id", "note-type-id");
			expect(deleted).toBe(true);
		});
	});
});
