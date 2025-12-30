import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware, Errors, getAuthUser } from "../middleware/index.js";
import {
	type DeckRepository,
	deckRepository,
	type NoteRepository,
	noteRepository,
} from "../repositories/index.js";
import { createNoteSchema, updateNoteSchema } from "../schemas/index.js";

export interface NoteDependencies {
	noteRepo: NoteRepository;
	deckRepo: DeckRepository;
}

const deckIdParamSchema = z.object({
	deckId: z.uuid(),
});

const noteIdParamSchema = z.object({
	deckId: z.uuid(),
	noteId: z.uuid(),
});

export function createNotesRouter(deps: NoteDependencies) {
	const { noteRepo, deckRepo } = deps;

	return (
		new Hono()
			.use("*", authMiddleware)
			// List notes in deck
			.get("/", zValidator("param", deckIdParamSchema), async (c) => {
				const user = getAuthUser(c);
				const { deckId } = c.req.valid("param");

				const deck = await deckRepo.findById(deckId, user.id);
				if (!deck) {
					throw Errors.notFound("Deck not found", "DECK_NOT_FOUND");
				}

				const notes = await noteRepo.findByDeckId(deckId);
				return c.json({ notes }, 200);
			})
			// Create note (auto-generates cards)
			.post(
				"/",
				zValidator("param", deckIdParamSchema),
				zValidator("json", createNoteSchema),
				async (c) => {
					const user = getAuthUser(c);
					const { deckId } = c.req.valid("param");
					const data = c.req.valid("json");

					const deck = await deckRepo.findById(deckId, user.id);
					if (!deck) {
						throw Errors.notFound("Deck not found", "DECK_NOT_FOUND");
					}

					try {
						const result = await noteRepo.create(deckId, {
							noteTypeId: data.noteTypeId,
							fields: data.fields,
						});

						return c.json(
							{
								note: result.note,
								fieldValues: result.fieldValues,
								cards: result.cards,
							},
							201,
						);
					} catch (error) {
						if (
							error instanceof Error &&
							error.message === "Note type not found"
						) {
							throw Errors.notFound(
								"Note type not found",
								"NOTE_TYPE_NOT_FOUND",
							);
						}
						throw error;
					}
				},
			)
			// Get note with field values
			.get("/:noteId", zValidator("param", noteIdParamSchema), async (c) => {
				const user = getAuthUser(c);
				const { deckId, noteId } = c.req.valid("param");

				const deck = await deckRepo.findById(deckId, user.id);
				if (!deck) {
					throw Errors.notFound("Deck not found", "DECK_NOT_FOUND");
				}

				const note = await noteRepo.findByIdWithFieldValues(noteId, deckId);
				if (!note) {
					throw Errors.notFound("Note not found", "NOTE_NOT_FOUND");
				}

				return c.json({ note }, 200);
			})
			// Update note field values
			.put(
				"/:noteId",
				zValidator("param", noteIdParamSchema),
				zValidator("json", updateNoteSchema),
				async (c) => {
					const user = getAuthUser(c);
					const { deckId, noteId } = c.req.valid("param");
					const data = c.req.valid("json");

					const deck = await deckRepo.findById(deckId, user.id);
					if (!deck) {
						throw Errors.notFound("Deck not found", "DECK_NOT_FOUND");
					}

					const note = await noteRepo.update(noteId, deckId, data.fields);
					if (!note) {
						throw Errors.notFound("Note not found", "NOTE_NOT_FOUND");
					}

					return c.json({ note }, 200);
				},
			)
			// Delete note and its cards
			.delete("/:noteId", zValidator("param", noteIdParamSchema), async (c) => {
				const user = getAuthUser(c);
				const { deckId, noteId } = c.req.valid("param");

				const deck = await deckRepo.findById(deckId, user.id);
				if (!deck) {
					throw Errors.notFound("Deck not found", "DECK_NOT_FOUND");
				}

				const deleted = await noteRepo.softDelete(noteId, deckId);
				if (!deleted) {
					throw Errors.notFound("Note not found", "NOTE_NOT_FOUND");
				}

				return c.json({ success: true }, 200);
			})
	);
}

export const notes = createNotesRouter({
	noteRepo: noteRepository,
	deckRepo: deckRepository,
});
