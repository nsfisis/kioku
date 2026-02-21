import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware, Errors, getAuthUser } from "../middleware/index.js";
import {
	type NoteFieldTypeRepository,
	type NoteTypeRepository,
	noteFieldTypeRepository,
	noteTypeRepository,
} from "../repositories/index.js";
import {
	createNoteFieldTypeSchema,
	createNoteTypeSchema,
	updateNoteFieldTypeSchema,
	updateNoteTypeSchema,
} from "../schemas/index.js";

export interface NoteTypeDependencies {
	noteTypeRepo: NoteTypeRepository;
	noteFieldTypeRepo: NoteFieldTypeRepository;
}

const noteTypeIdParamSchema = z.object({
	id: z.uuid(),
});

const noteTypeFieldIdParamSchema = z.object({
	id: z.uuid(),
	fieldId: z.uuid(),
});

const reorderFieldsSchema = z.object({
	fieldIds: z.array(z.uuid()),
});

export function createNoteTypesRouter(deps: NoteTypeDependencies) {
	const { noteTypeRepo, noteFieldTypeRepo } = deps;

	return (
		new Hono()
			.use("*", authMiddleware)
			// List user's note types
			.get("/", async (c) => {
				const user = getAuthUser(c);
				const noteTypes = await noteTypeRepo.findByUserId(user.id);
				return c.json({ noteTypes }, 200);
			})
			// Create note type
			.post("/", zValidator("json", createNoteTypeSchema), async (c) => {
				const user = getAuthUser(c);
				const data = c.req.valid("json");

				const noteType = await noteTypeRepo.create({
					userId: user.id,
					name: data.name,
					frontTemplate: data.frontTemplate,
					backTemplate: data.backTemplate,
					isReversible: data.isReversible,
				});

				return c.json({ noteType }, 201);
			})
			// Get note type with fields
			.get("/:id", zValidator("param", noteTypeIdParamSchema), async (c) => {
				const user = getAuthUser(c);
				const { id } = c.req.valid("param");

				const noteType = await noteTypeRepo.findByIdWithFields(id, user.id);
				if (!noteType) {
					throw Errors.notFound("Note type not found", "NOTE_TYPE_NOT_FOUND");
				}

				return c.json({ noteType }, 200);
			})
			// Update note type
			.put(
				"/:id",
				zValidator("param", noteTypeIdParamSchema),
				zValidator("json", updateNoteTypeSchema),
				async (c) => {
					const user = getAuthUser(c);
					const { id } = c.req.valid("param");
					const data = c.req.valid("json");

					const noteType = await noteTypeRepo.update(id, user.id, data);
					if (!noteType) {
						throw Errors.notFound("Note type not found", "NOTE_TYPE_NOT_FOUND");
					}

					return c.json({ noteType }, 200);
				},
			)
			// Delete note type (soft delete)
			.delete("/:id", zValidator("param", noteTypeIdParamSchema), async (c) => {
				const user = getAuthUser(c);
				const { id } = c.req.valid("param");

				// Check if there are notes referencing this note type
				const hasNotes = await noteTypeRepo.hasNotes(id, user.id);
				if (hasNotes) {
					throw Errors.conflict(
						"Cannot delete note type with existing notes",
						"NOTE_TYPE_HAS_NOTES",
					);
				}

				const deleted = await noteTypeRepo.softDelete(id, user.id);
				if (!deleted) {
					throw Errors.notFound("Note type not found", "NOTE_TYPE_NOT_FOUND");
				}

				return c.json({ success: true }, 200);
			})
			// Add field to note type
			.post(
				"/:id/fields",
				zValidator("param", noteTypeIdParamSchema),
				zValidator("json", createNoteFieldTypeSchema),
				async (c) => {
					const user = getAuthUser(c);
					const { id } = c.req.valid("param");
					const data = c.req.valid("json");

					// Verify note type exists and belongs to user
					const noteType = await noteTypeRepo.findById(id, user.id);
					if (!noteType) {
						throw Errors.notFound("Note type not found", "NOTE_TYPE_NOT_FOUND");
					}

					const field = await noteFieldTypeRepo.create(id, {
						name: data.name,
						order: data.order,
						fieldType: data.fieldType,
					});

					return c.json({ field }, 201);
				},
			)
			// Reorder fields (must come before /:id/fields/:fieldId to avoid matching "reorder" as fieldId)
			.put(
				"/:id/fields/reorder",
				zValidator("param", noteTypeIdParamSchema),
				zValidator("json", reorderFieldsSchema),
				async (c) => {
					const user = getAuthUser(c);
					const { id } = c.req.valid("param");
					const { fieldIds } = c.req.valid("json");

					// Verify note type exists and belongs to user
					const noteType = await noteTypeRepo.findById(id, user.id);
					if (!noteType) {
						throw Errors.notFound("Note type not found", "NOTE_TYPE_NOT_FOUND");
					}

					const fields = await noteFieldTypeRepo.reorder(id, fieldIds);

					return c.json({ fields }, 200);
				},
			)
			// Update field
			.put(
				"/:id/fields/:fieldId",
				zValidator("param", noteTypeFieldIdParamSchema),
				zValidator("json", updateNoteFieldTypeSchema),
				async (c) => {
					const user = getAuthUser(c);
					const { id, fieldId } = c.req.valid("param");
					const data = c.req.valid("json");

					// Verify note type exists and belongs to user
					const noteType = await noteTypeRepo.findById(id, user.id);
					if (!noteType) {
						throw Errors.notFound("Note type not found", "NOTE_TYPE_NOT_FOUND");
					}

					const field = await noteFieldTypeRepo.update(fieldId, id, data);
					if (!field) {
						throw Errors.notFound("Field not found", "FIELD_NOT_FOUND");
					}

					return c.json({ field }, 200);
				},
			)
			// Delete field
			.delete(
				"/:id/fields/:fieldId",
				zValidator("param", noteTypeFieldIdParamSchema),
				async (c) => {
					const user = getAuthUser(c);
					const { id, fieldId } = c.req.valid("param");
					const force = c.req.query("force") === "true";

					// Verify note type exists and belongs to user
					const noteType = await noteTypeRepo.findById(id, user.id);
					if (!noteType) {
						throw Errors.notFound("Note type not found", "NOTE_TYPE_NOT_FOUND");
					}

					// Check if there are note field values referencing this field
					const hasValues = await noteFieldTypeRepo.hasNoteFieldValues(fieldId);
					if (hasValues && !force) {
						const cardCount = await noteTypeRepo.countCards(id);
						return c.json(
							{
								error: {
									message: "Cannot delete field with existing values",
									code: "FIELD_HAS_VALUES",
								},
								cardCount,
							},
							409,
						);
					}

					const deleted = await noteFieldTypeRepo.softDelete(fieldId, id);
					if (!deleted) {
						throw Errors.notFound("Field not found", "FIELD_NOT_FOUND");
					}

					return c.json({ success: true }, 200);
				},
			)
	);
}

export const noteTypes = createNoteTypesRouter({
	noteTypeRepo: noteTypeRepository,
	noteFieldTypeRepo: noteFieldTypeRepository,
});
