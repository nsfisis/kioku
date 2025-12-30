import { Hono } from "hono";
import { sign } from "hono/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/index.js";
import type {
	NoteFieldType,
	NoteFieldTypeRepository,
	NoteType,
	NoteTypeRepository,
	NoteTypeWithFields,
} from "../repositories/index.js";
import { createNoteTypesRouter } from "./noteTypes.js";

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

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

async function createTestToken(userId: string): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	return sign(
		{
			sub: userId,
			iat: now,
			exp: now + 900,
		},
		JWT_SECRET,
	);
}

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
		id: "field-uuid-123",
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

interface NoteTypeResponse {
	noteType?: NoteType | NoteTypeWithFields;
	noteTypes?: NoteType[];
	field?: NoteFieldType;
	fields?: NoteFieldType[];
	success?: boolean;
	error?: {
		code: string;
		message: string;
	};
}

describe("GET /api/note-types", () => {
	let app: Hono;
	let mockNoteTypeRepo: ReturnType<typeof createMockNoteTypeRepo>;
	let mockNoteFieldTypeRepo: ReturnType<typeof createMockNoteFieldTypeRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockNoteTypeRepo = createMockNoteTypeRepo();
		mockNoteFieldTypeRepo = createMockNoteFieldTypeRepo();
		const noteTypesRouter = createNoteTypesRouter({
			noteTypeRepo: mockNoteTypeRepo,
			noteFieldTypeRepo: mockNoteFieldTypeRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/note-types", noteTypesRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("returns empty array when user has no note types", async () => {
		vi.mocked(mockNoteTypeRepo.findByUserId).mockResolvedValue([]);

		const res = await app.request("/api/note-types", {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.noteTypes).toEqual([]);
		expect(mockNoteTypeRepo.findByUserId).toHaveBeenCalledWith("user-uuid-123");
	});

	it("returns user note types", async () => {
		const mockNoteTypes = [
			createMockNoteType({ id: "type-1", name: "Basic" }),
			createMockNoteType({
				id: "type-2",
				name: "Basic (and reversed)",
				isReversible: true,
			}),
		];
		vi.mocked(mockNoteTypeRepo.findByUserId).mockResolvedValue(mockNoteTypes);

		const res = await app.request("/api/note-types", {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.noteTypes).toHaveLength(2);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request("/api/note-types", {
			method: "GET",
		});

		expect(res.status).toBe(401);
	});
});

describe("POST /api/note-types", () => {
	let app: Hono;
	let mockNoteTypeRepo: ReturnType<typeof createMockNoteTypeRepo>;
	let mockNoteFieldTypeRepo: ReturnType<typeof createMockNoteFieldTypeRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockNoteTypeRepo = createMockNoteTypeRepo();
		mockNoteFieldTypeRepo = createMockNoteFieldTypeRepo();
		const noteTypesRouter = createNoteTypesRouter({
			noteTypeRepo: mockNoteTypeRepo,
			noteFieldTypeRepo: mockNoteFieldTypeRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/note-types", noteTypesRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("creates a new note type", async () => {
		const newNoteType = createMockNoteType({ name: "Custom Type" });
		vi.mocked(mockNoteTypeRepo.create).mockResolvedValue(newNoteType);

		const res = await app.request("/api/note-types", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name: "Custom Type",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
			}),
		});

		expect(res.status).toBe(201);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.noteType?.name).toBe("Custom Type");
		expect(mockNoteTypeRepo.create).toHaveBeenCalledWith({
			userId: "user-uuid-123",
			name: "Custom Type",
			frontTemplate: "{{Front}}",
			backTemplate: "{{Back}}",
			isReversible: false,
		});
	});

	it("creates a reversible note type", async () => {
		const newNoteType = createMockNoteType({
			name: "Reversible",
			isReversible: true,
		});
		vi.mocked(mockNoteTypeRepo.create).mockResolvedValue(newNoteType);

		const res = await app.request("/api/note-types", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name: "Reversible",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: true,
			}),
		});

		expect(res.status).toBe(201);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.noteType?.isReversible).toBe(true);
	});

	it("returns 400 for missing required fields", async () => {
		const res = await app.request("/api/note-types", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: "Test" }),
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request("/api/note-types", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Test",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
			}),
		});

		expect(res.status).toBe(401);
	});
});

describe("GET /api/note-types/:id", () => {
	let app: Hono;
	let mockNoteTypeRepo: ReturnType<typeof createMockNoteTypeRepo>;
	let mockNoteFieldTypeRepo: ReturnType<typeof createMockNoteFieldTypeRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockNoteTypeRepo = createMockNoteTypeRepo();
		mockNoteFieldTypeRepo = createMockNoteFieldTypeRepo();
		const noteTypesRouter = createNoteTypesRouter({
			noteTypeRepo: mockNoteTypeRepo,
			noteFieldTypeRepo: mockNoteFieldTypeRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/note-types", noteTypesRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("returns note type with fields", async () => {
		const noteTypeId = "a0000000-0000-4000-8000-000000000001";
		const mockNoteType: NoteTypeWithFields = {
			...createMockNoteType({ id: noteTypeId }),
			fields: [
				createMockNoteFieldType({ id: "field-1", name: "Front", order: 0 }),
				createMockNoteFieldType({ id: "field-2", name: "Back", order: 1 }),
			],
		};
		vi.mocked(mockNoteTypeRepo.findByIdWithFields).mockResolvedValue(
			mockNoteType,
		);

		const res = await app.request(`/api/note-types/${noteTypeId}`, {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.noteType?.id).toBe(noteTypeId);
		expect((body.noteType as NoteTypeWithFields)?.fields).toHaveLength(2);
		expect(mockNoteTypeRepo.findByIdWithFields).toHaveBeenCalledWith(
			noteTypeId,
			"user-uuid-123",
		);
	});

	it("returns 404 for non-existent note type", async () => {
		vi.mocked(mockNoteTypeRepo.findByIdWithFields).mockResolvedValue(undefined);

		const res = await app.request(
			"/api/note-types/00000000-0000-0000-0000-000000000000",
			{
				method: "GET",
				headers: { Authorization: `Bearer ${authToken}` },
			},
		);

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.error?.code).toBe("NOTE_TYPE_NOT_FOUND");
	});

	it("returns 400 for invalid uuid", async () => {
		const res = await app.request("/api/note-types/invalid-id", {
			method: "GET",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request("/api/note-types/note-type-uuid-123", {
			method: "GET",
		});

		expect(res.status).toBe(401);
	});
});

describe("PUT /api/note-types/:id", () => {
	let app: Hono;
	let mockNoteTypeRepo: ReturnType<typeof createMockNoteTypeRepo>;
	let mockNoteFieldTypeRepo: ReturnType<typeof createMockNoteFieldTypeRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockNoteTypeRepo = createMockNoteTypeRepo();
		mockNoteFieldTypeRepo = createMockNoteFieldTypeRepo();
		const noteTypesRouter = createNoteTypesRouter({
			noteTypeRepo: mockNoteTypeRepo,
			noteFieldTypeRepo: mockNoteFieldTypeRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/note-types", noteTypesRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("updates note type name", async () => {
		const updatedNoteType = createMockNoteType({ name: "Updated Name" });
		vi.mocked(mockNoteTypeRepo.update).mockResolvedValue(updatedNoteType);

		const res = await app.request(
			"/api/note-types/00000000-0000-0000-0000-000000000000",
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name: "Updated Name" }),
			},
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.noteType?.name).toBe("Updated Name");
	});

	it("updates note type templates", async () => {
		const updatedNoteType = createMockNoteType({
			frontTemplate: "Q: {{Front}}",
			backTemplate: "A: {{Back}}",
		});
		vi.mocked(mockNoteTypeRepo.update).mockResolvedValue(updatedNoteType);

		const res = await app.request(
			"/api/note-types/00000000-0000-0000-0000-000000000000",
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					frontTemplate: "Q: {{Front}}",
					backTemplate: "A: {{Back}}",
				}),
			},
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.noteType?.frontTemplate).toBe("Q: {{Front}}");
		expect(body.noteType?.backTemplate).toBe("A: {{Back}}");
	});

	it("updates isReversible flag", async () => {
		const updatedNoteType = createMockNoteType({ isReversible: true });
		vi.mocked(mockNoteTypeRepo.update).mockResolvedValue(updatedNoteType);

		const res = await app.request(
			"/api/note-types/00000000-0000-0000-0000-000000000000",
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ isReversible: true }),
			},
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.noteType?.isReversible).toBe(true);
	});

	it("returns 404 for non-existent note type", async () => {
		vi.mocked(mockNoteTypeRepo.update).mockResolvedValue(undefined);

		const res = await app.request(
			"/api/note-types/00000000-0000-0000-0000-000000000000",
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name: "Test" }),
			},
		);

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.error?.code).toBe("NOTE_TYPE_NOT_FOUND");
	});

	it("returns 400 for invalid uuid", async () => {
		const res = await app.request("/api/note-types/invalid-id", {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: "Test" }),
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(
			"/api/note-types/00000000-0000-0000-0000-000000000000",
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Test" }),
			},
		);

		expect(res.status).toBe(401);
	});
});

describe("DELETE /api/note-types/:id", () => {
	let app: Hono;
	let mockNoteTypeRepo: ReturnType<typeof createMockNoteTypeRepo>;
	let mockNoteFieldTypeRepo: ReturnType<typeof createMockNoteFieldTypeRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockNoteTypeRepo = createMockNoteTypeRepo();
		mockNoteFieldTypeRepo = createMockNoteFieldTypeRepo();
		const noteTypesRouter = createNoteTypesRouter({
			noteTypeRepo: mockNoteTypeRepo,
			noteFieldTypeRepo: mockNoteFieldTypeRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/note-types", noteTypesRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("deletes note type successfully", async () => {
		vi.mocked(mockNoteTypeRepo.hasNotes).mockResolvedValue(false);
		vi.mocked(mockNoteTypeRepo.softDelete).mockResolvedValue(true);

		const res = await app.request(
			"/api/note-types/00000000-0000-0000-0000-000000000000",
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${authToken}` },
			},
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.success).toBe(true);
		expect(mockNoteTypeRepo.softDelete).toHaveBeenCalledWith(
			"00000000-0000-0000-0000-000000000000",
			"user-uuid-123",
		);
	});

	it("returns 409 when note type has notes", async () => {
		vi.mocked(mockNoteTypeRepo.hasNotes).mockResolvedValue(true);

		const res = await app.request(
			"/api/note-types/00000000-0000-0000-0000-000000000000",
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${authToken}` },
			},
		);

		expect(res.status).toBe(409);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.error?.code).toBe("NOTE_TYPE_HAS_NOTES");
	});

	it("returns 404 for non-existent note type", async () => {
		vi.mocked(mockNoteTypeRepo.hasNotes).mockResolvedValue(false);
		vi.mocked(mockNoteTypeRepo.softDelete).mockResolvedValue(false);

		const res = await app.request(
			"/api/note-types/00000000-0000-0000-0000-000000000000",
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${authToken}` },
			},
		);

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.error?.code).toBe("NOTE_TYPE_NOT_FOUND");
	});

	it("returns 400 for invalid uuid", async () => {
		const res = await app.request("/api/note-types/invalid-id", {
			method: "DELETE",
			headers: { Authorization: `Bearer ${authToken}` },
		});

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(
			"/api/note-types/00000000-0000-0000-0000-000000000000",
			{
				method: "DELETE",
			},
		);

		expect(res.status).toBe(401);
	});
});

describe("POST /api/note-types/:id/fields", () => {
	let app: Hono;
	let mockNoteTypeRepo: ReturnType<typeof createMockNoteTypeRepo>;
	let mockNoteFieldTypeRepo: ReturnType<typeof createMockNoteFieldTypeRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockNoteTypeRepo = createMockNoteTypeRepo();
		mockNoteFieldTypeRepo = createMockNoteFieldTypeRepo();
		const noteTypesRouter = createNoteTypesRouter({
			noteTypeRepo: mockNoteTypeRepo,
			noteFieldTypeRepo: mockNoteFieldTypeRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/note-types", noteTypesRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("creates a new field", async () => {
		const noteTypeId = "00000000-0000-0000-0000-000000000000";
		const mockNoteType = createMockNoteType({ id: noteTypeId });
		const newField = createMockNoteFieldType({
			noteTypeId,
			name: "Extra",
			order: 2,
		});

		vi.mocked(mockNoteTypeRepo.findById).mockResolvedValue(mockNoteType);
		vi.mocked(mockNoteFieldTypeRepo.create).mockResolvedValue(newField);

		const res = await app.request(`/api/note-types/${noteTypeId}/fields`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: "Extra", order: 2 }),
		});

		expect(res.status).toBe(201);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.field?.name).toBe("Extra");
		expect(mockNoteFieldTypeRepo.create).toHaveBeenCalledWith(noteTypeId, {
			name: "Extra",
			order: 2,
			fieldType: "text",
		});
	});

	it("returns 404 when note type not found", async () => {
		vi.mocked(mockNoteTypeRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(
			"/api/note-types/00000000-0000-0000-0000-000000000000/fields",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name: "Extra", order: 2 }),
			},
		);

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.error?.code).toBe("NOTE_TYPE_NOT_FOUND");
	});

	it("returns 400 for missing required fields", async () => {
		const res = await app.request(
			"/api/note-types/00000000-0000-0000-0000-000000000000/fields",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name: "Extra" }),
			},
		);

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(
			"/api/note-types/00000000-0000-0000-0000-000000000000/fields",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Extra", order: 2 }),
			},
		);

		expect(res.status).toBe(401);
	});
});

describe("PUT /api/note-types/:id/fields/:fieldId", () => {
	let app: Hono;
	let mockNoteTypeRepo: ReturnType<typeof createMockNoteTypeRepo>;
	let mockNoteFieldTypeRepo: ReturnType<typeof createMockNoteFieldTypeRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockNoteTypeRepo = createMockNoteTypeRepo();
		mockNoteFieldTypeRepo = createMockNoteFieldTypeRepo();
		const noteTypesRouter = createNoteTypesRouter({
			noteTypeRepo: mockNoteTypeRepo,
			noteFieldTypeRepo: mockNoteFieldTypeRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/note-types", noteTypesRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("updates field name", async () => {
		const noteTypeId = "a0000000-0000-4000-8000-000000000001";
		const fieldId = "b0000000-0000-4000-8000-000000000002";
		const mockNoteType = createMockNoteType({ id: noteTypeId });
		const updatedField = createMockNoteFieldType({
			id: fieldId,
			noteTypeId,
			name: "Updated Name",
		});

		vi.mocked(mockNoteTypeRepo.findById).mockResolvedValue(mockNoteType);
		vi.mocked(mockNoteFieldTypeRepo.update).mockResolvedValue(updatedField);

		const res = await app.request(
			`/api/note-types/${noteTypeId}/fields/${fieldId}`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name: "Updated Name" }),
			},
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.field?.name).toBe("Updated Name");
	});

	it("returns 404 when note type not found", async () => {
		const noteTypeId = "a0000000-0000-4000-8000-000000000001";
		const fieldId = "b0000000-0000-4000-8000-000000000002";
		vi.mocked(mockNoteTypeRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(
			`/api/note-types/${noteTypeId}/fields/${fieldId}`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name: "Updated" }),
			},
		);

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.error?.code).toBe("NOTE_TYPE_NOT_FOUND");
	});

	it("returns 404 when field not found", async () => {
		const noteTypeId = "a0000000-0000-4000-8000-000000000001";
		const fieldId = "b0000000-0000-4000-8000-000000000002";
		const mockNoteType = createMockNoteType({ id: noteTypeId });

		vi.mocked(mockNoteTypeRepo.findById).mockResolvedValue(mockNoteType);
		vi.mocked(mockNoteFieldTypeRepo.update).mockResolvedValue(undefined);

		const res = await app.request(
			`/api/note-types/${noteTypeId}/fields/${fieldId}`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name: "Updated" }),
			},
		);

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.error?.code).toBe("FIELD_NOT_FOUND");
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(
			"/api/note-types/a0000000-0000-4000-8000-000000000001/fields/b0000000-0000-4000-8000-000000000002",
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Updated" }),
			},
		);

		expect(res.status).toBe(401);
	});
});

describe("DELETE /api/note-types/:id/fields/:fieldId", () => {
	let app: Hono;
	let mockNoteTypeRepo: ReturnType<typeof createMockNoteTypeRepo>;
	let mockNoteFieldTypeRepo: ReturnType<typeof createMockNoteFieldTypeRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockNoteTypeRepo = createMockNoteTypeRepo();
		mockNoteFieldTypeRepo = createMockNoteFieldTypeRepo();
		const noteTypesRouter = createNoteTypesRouter({
			noteTypeRepo: mockNoteTypeRepo,
			noteFieldTypeRepo: mockNoteFieldTypeRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/note-types", noteTypesRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("deletes field successfully", async () => {
		const noteTypeId = "a0000000-0000-4000-8000-000000000001";
		const fieldId = "b0000000-0000-4000-8000-000000000002";
		const mockNoteType = createMockNoteType({ id: noteTypeId });

		vi.mocked(mockNoteTypeRepo.findById).mockResolvedValue(mockNoteType);
		vi.mocked(mockNoteFieldTypeRepo.hasNoteFieldValues).mockResolvedValue(
			false,
		);
		vi.mocked(mockNoteFieldTypeRepo.softDelete).mockResolvedValue(true);

		const res = await app.request(
			`/api/note-types/${noteTypeId}/fields/${fieldId}`,
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${authToken}` },
			},
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.success).toBe(true);
		expect(mockNoteFieldTypeRepo.softDelete).toHaveBeenCalledWith(
			fieldId,
			noteTypeId,
		);
	});

	it("returns 409 when field has values", async () => {
		const noteTypeId = "a0000000-0000-4000-8000-000000000001";
		const fieldId = "b0000000-0000-4000-8000-000000000002";
		const mockNoteType = createMockNoteType({ id: noteTypeId });

		vi.mocked(mockNoteTypeRepo.findById).mockResolvedValue(mockNoteType);
		vi.mocked(mockNoteFieldTypeRepo.hasNoteFieldValues).mockResolvedValue(true);

		const res = await app.request(
			`/api/note-types/${noteTypeId}/fields/${fieldId}`,
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${authToken}` },
			},
		);

		expect(res.status).toBe(409);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.error?.code).toBe("FIELD_HAS_VALUES");
	});

	it("returns 404 when note type not found", async () => {
		const noteTypeId = "a0000000-0000-4000-8000-000000000001";
		const fieldId = "b0000000-0000-4000-8000-000000000002";
		vi.mocked(mockNoteTypeRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(
			`/api/note-types/${noteTypeId}/fields/${fieldId}`,
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${authToken}` },
			},
		);

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.error?.code).toBe("NOTE_TYPE_NOT_FOUND");
	});

	it("returns 404 when field not found", async () => {
		const noteTypeId = "a0000000-0000-4000-8000-000000000001";
		const fieldId = "b0000000-0000-4000-8000-000000000002";
		const mockNoteType = createMockNoteType({ id: noteTypeId });

		vi.mocked(mockNoteTypeRepo.findById).mockResolvedValue(mockNoteType);
		vi.mocked(mockNoteFieldTypeRepo.hasNoteFieldValues).mockResolvedValue(
			false,
		);
		vi.mocked(mockNoteFieldTypeRepo.softDelete).mockResolvedValue(false);

		const res = await app.request(
			`/api/note-types/${noteTypeId}/fields/${fieldId}`,
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${authToken}` },
			},
		);

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.error?.code).toBe("FIELD_NOT_FOUND");
	});

	it("returns 401 when not authenticated", async () => {
		const res = await app.request(
			"/api/note-types/a0000000-0000-4000-8000-000000000001/fields/b0000000-0000-4000-8000-000000000002",
			{
				method: "DELETE",
			},
		);

		expect(res.status).toBe(401);
	});
});

describe("PUT /api/note-types/:id/fields/reorder", () => {
	let app: Hono;
	let mockNoteTypeRepo: ReturnType<typeof createMockNoteTypeRepo>;
	let mockNoteFieldTypeRepo: ReturnType<typeof createMockNoteFieldTypeRepo>;
	let authToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockNoteTypeRepo = createMockNoteTypeRepo();
		mockNoteFieldTypeRepo = createMockNoteFieldTypeRepo();
		const noteTypesRouter = createNoteTypesRouter({
			noteTypeRepo: mockNoteTypeRepo,
			noteFieldTypeRepo: mockNoteFieldTypeRepo,
		});
		app = new Hono();
		app.onError(errorHandler);
		app.route("/api/note-types", noteTypesRouter);
		authToken = await createTestToken("user-uuid-123");
	});

	it("reorders fields successfully", async () => {
		const noteTypeId = "a0000000-0000-4000-8000-000000000001";
		const fieldId1 = "b0000000-0000-4000-8000-000000000002";
		const fieldId2 = "c0000000-0000-4000-8000-000000000003";
		const mockNoteType = createMockNoteType({ id: noteTypeId });
		const reorderedFields = [
			createMockNoteFieldType({ id: fieldId2, order: 0 }),
			createMockNoteFieldType({ id: fieldId1, order: 1 }),
		];

		vi.mocked(mockNoteTypeRepo.findById).mockResolvedValue(mockNoteType);
		vi.mocked(mockNoteFieldTypeRepo.reorder).mockResolvedValue(reorderedFields);

		const res = await app.request(
			`/api/note-types/${noteTypeId}/fields/reorder`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ fieldIds: [fieldId2, fieldId1] }),
			},
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.fields).toHaveLength(2);
		expect(mockNoteFieldTypeRepo.reorder).toHaveBeenCalledWith(noteTypeId, [
			fieldId2,
			fieldId1,
		]);
	});

	it("returns 404 when note type not found", async () => {
		const noteTypeId = "a0000000-0000-4000-8000-000000000001";
		const fieldId1 = "b0000000-0000-4000-8000-000000000002";
		const fieldId2 = "c0000000-0000-4000-8000-000000000003";
		vi.mocked(mockNoteTypeRepo.findById).mockResolvedValue(undefined);

		const res = await app.request(
			`/api/note-types/${noteTypeId}/fields/reorder`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					fieldIds: [fieldId1, fieldId2],
				}),
			},
		);

		expect(res.status).toBe(404);
		const body = (await res.json()) as NoteTypeResponse;
		expect(body.error?.code).toBe("NOTE_TYPE_NOT_FOUND");
	});

	it("returns 400 for invalid fieldIds", async () => {
		const noteTypeId = "a0000000-0000-4000-8000-000000000001";
		const res = await app.request(
			`/api/note-types/${noteTypeId}/fields/reorder`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${authToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ fieldIds: ["invalid-id"] }),
			},
		);

		expect(res.status).toBe(400);
	});

	it("returns 401 when not authenticated", async () => {
		const noteTypeId = "a0000000-0000-4000-8000-000000000001";
		const fieldId1 = "b0000000-0000-4000-8000-000000000002";
		const fieldId2 = "c0000000-0000-4000-8000-000000000003";
		const res = await app.request(
			`/api/note-types/${noteTypeId}/fields/reorder`,
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					fieldIds: [fieldId1, fieldId2],
				}),
			},
		);

		expect(res.status).toBe(401);
	});
});
