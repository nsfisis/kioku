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
