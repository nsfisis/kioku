import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
	cards,
	decks,
	noteFieldTypes,
	noteFieldValues,
	notes,
	noteTypes,
	reviewLogs,
} from "../db/schema.js";
import type {
	Card,
	Deck,
	Note,
	NoteFieldType,
	NoteFieldValue,
	NoteType,
	ReviewLog,
} from "./types.js";

/**
 * Sync data types for push/pull operations
 */
export interface SyncPushData {
	decks: SyncDeckData[];
	cards: SyncCardData[];
	reviewLogs: SyncReviewLogData[];
	noteTypes: SyncNoteTypeData[];
	noteFieldTypes: SyncNoteFieldTypeData[];
	notes: SyncNoteData[];
	noteFieldValues: SyncNoteFieldValueData[];
}

export interface SyncDeckData {
	id: string;
	name: string;
	description: string | null;
	newCardsPerDay: number;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
}

export interface SyncCardData {
	id: string;
	deckId: string;
	noteId: string;
	isReversed: boolean;
	front: string;
	back: string;
	state: number;
	due: string;
	stability: number;
	difficulty: number;
	elapsedDays: number;
	scheduledDays: number;
	reps: number;
	lapses: number;
	lastReview: string | null;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
}

export interface SyncReviewLogData {
	id: string;
	cardId: string;
	rating: number;
	state: number;
	scheduledDays: number;
	elapsedDays: number;
	reviewedAt: string;
	durationMs: number | null;
}

export interface SyncNoteTypeData {
	id: string;
	name: string;
	frontTemplate: string;
	backTemplate: string;
	isReversible: boolean;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
}

export interface SyncNoteFieldTypeData {
	id: string;
	noteTypeId: string;
	name: string;
	order: number;
	fieldType: string;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
}

export interface SyncNoteData {
	id: string;
	deckId: string;
	noteTypeId: string;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
}

export interface SyncNoteFieldValueData {
	id: string;
	noteId: string;
	noteFieldTypeId: string;
	value: string;
	createdAt: string;
	updatedAt: string;
}

export interface SyncPushResult {
	decks: { id: string; syncVersion: number }[];
	cards: { id: string; syncVersion: number }[];
	reviewLogs: { id: string; syncVersion: number }[];
	noteTypes: { id: string; syncVersion: number }[];
	noteFieldTypes: { id: string; syncVersion: number }[];
	notes: { id: string; syncVersion: number }[];
	noteFieldValues: { id: string; syncVersion: number }[];
	conflicts: {
		decks: string[];
		cards: string[];
		noteTypes: string[];
		noteFieldTypes: string[];
		notes: string[];
		noteFieldValues: string[];
	};
}

export interface SyncPullQuery {
	lastSyncVersion: number;
}

export interface SyncPullResult {
	decks: Deck[];
	cards: Card[];
	reviewLogs: ReviewLog[];
	noteTypes: NoteType[];
	noteFieldTypes: NoteFieldType[];
	notes: Note[];
	noteFieldValues: NoteFieldValue[];
	currentSyncVersion: number;
}

export interface SyncRepository {
	pushChanges(userId: string, data: SyncPushData): Promise<SyncPushResult>;
	pullChanges(userId: string, query: SyncPullQuery): Promise<SyncPullResult>;
}

export const syncRepository: SyncRepository = {
	async pushChanges(
		userId: string,
		data: SyncPushData,
	): Promise<SyncPushResult> {
		const result: SyncPushResult = {
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [],
			conflicts: {
				decks: [],
				cards: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
			},
		};

		// Process decks with Last-Write-Wins conflict resolution
		for (const deckData of data.decks) {
			const clientUpdatedAt = new Date(deckData.updatedAt);

			// Check if deck exists
			const existing = await db
				.select({
					id: decks.id,
					updatedAt: decks.updatedAt,
					syncVersion: decks.syncVersion,
				})
				.from(decks)
				.where(and(eq(decks.id, deckData.id), eq(decks.userId, userId)));

			if (existing.length === 0) {
				// New deck - insert
				const [inserted] = await db
					.insert(decks)
					.values({
						id: deckData.id,
						userId,
						name: deckData.name,
						description: deckData.description,
						newCardsPerDay: deckData.newCardsPerDay,
						createdAt: new Date(deckData.createdAt),
						updatedAt: clientUpdatedAt,
						deletedAt: deckData.deletedAt ? new Date(deckData.deletedAt) : null,
						syncVersion: 1,
					})
					.returning({ id: decks.id, syncVersion: decks.syncVersion });

				if (inserted) {
					result.decks.push({
						id: inserted.id,
						syncVersion: inserted.syncVersion,
					});
				}
			} else {
				const serverDeck = existing[0];
				// Last-Write-Wins: compare timestamps
				if (serverDeck && clientUpdatedAt > serverDeck.updatedAt) {
					// Client wins - update
					const [updated] = await db
						.update(decks)
						.set({
							name: deckData.name,
							description: deckData.description,
							newCardsPerDay: deckData.newCardsPerDay,
							updatedAt: clientUpdatedAt,
							deletedAt: deckData.deletedAt
								? new Date(deckData.deletedAt)
								: null,
							syncVersion: sql`${decks.syncVersion} + 1`,
						})
						.where(eq(decks.id, deckData.id))
						.returning({ id: decks.id, syncVersion: decks.syncVersion });

					if (updated) {
						result.decks.push({
							id: updated.id,
							syncVersion: updated.syncVersion,
						});
					}
				} else if (serverDeck) {
					// Server wins - mark as conflict
					result.conflicts.decks.push(deckData.id);
					result.decks.push({
						id: serverDeck.id,
						syncVersion: serverDeck.syncVersion,
					});
				}
			}
		}

		// Process cards with Last-Write-Wins conflict resolution
		for (const cardData of data.cards) {
			const clientUpdatedAt = new Date(cardData.updatedAt);

			// Verify target deck belongs to user
			const deckCheck = await db
				.select({ id: decks.id })
				.from(decks)
				.where(and(eq(decks.id, cardData.deckId), eq(decks.userId, userId)));

			if (deckCheck.length === 0) {
				// Target deck doesn't belong to user, skip
				continue;
			}

			// Check if card exists AND belongs to user (via deck ownership)
			const existing = await db
				.select({
					id: cards.id,
					updatedAt: cards.updatedAt,
					syncVersion: cards.syncVersion,
				})
				.from(cards)
				.innerJoin(decks, eq(cards.deckId, decks.id))
				.where(and(eq(cards.id, cardData.id), eq(decks.userId, userId)));

			if (existing.length === 0) {
				// New card - insert
				const [inserted] = await db
					.insert(cards)
					.values({
						id: cardData.id,
						deckId: cardData.deckId,
						noteId: cardData.noteId,
						isReversed: cardData.isReversed,
						front: cardData.front,
						back: cardData.back,
						state: cardData.state,
						due: new Date(cardData.due),
						stability: cardData.stability,
						difficulty: cardData.difficulty,
						elapsedDays: cardData.elapsedDays,
						scheduledDays: cardData.scheduledDays,
						reps: cardData.reps,
						lapses: cardData.lapses,
						lastReview: cardData.lastReview
							? new Date(cardData.lastReview)
							: null,
						createdAt: new Date(cardData.createdAt),
						updatedAt: clientUpdatedAt,
						deletedAt: cardData.deletedAt ? new Date(cardData.deletedAt) : null,
						syncVersion: 1,
					})
					.returning({ id: cards.id, syncVersion: cards.syncVersion });

				if (inserted) {
					result.cards.push({
						id: inserted.id,
						syncVersion: inserted.syncVersion,
					});
				}
			} else {
				const serverCard = existing[0];
				// Last-Write-Wins: compare timestamps
				if (serverCard && clientUpdatedAt > serverCard.updatedAt) {
					// Client wins - update
					const [updated] = await db
						.update(cards)
						.set({
							deckId: cardData.deckId,
							noteId: cardData.noteId,
							isReversed: cardData.isReversed,
							front: cardData.front,
							back: cardData.back,
							state: cardData.state,
							due: new Date(cardData.due),
							stability: cardData.stability,
							difficulty: cardData.difficulty,
							elapsedDays: cardData.elapsedDays,
							scheduledDays: cardData.scheduledDays,
							reps: cardData.reps,
							lapses: cardData.lapses,
							lastReview: cardData.lastReview
								? new Date(cardData.lastReview)
								: null,
							updatedAt: clientUpdatedAt,
							deletedAt: cardData.deletedAt
								? new Date(cardData.deletedAt)
								: null,
							syncVersion: sql`${cards.syncVersion} + 1`,
						})
						.where(eq(cards.id, cardData.id))
						.returning({ id: cards.id, syncVersion: cards.syncVersion });

					if (updated) {
						result.cards.push({
							id: updated.id,
							syncVersion: updated.syncVersion,
						});
					}
				} else if (serverCard) {
					// Server wins - mark as conflict
					result.conflicts.cards.push(cardData.id);
					result.cards.push({
						id: serverCard.id,
						syncVersion: serverCard.syncVersion,
					});
				}
			}
		}

		// Process review logs (append-only, no conflicts)
		for (const logData of data.reviewLogs) {
			// Verify the card's deck belongs to user
			const cardCheck = await db
				.select({ id: cards.id })
				.from(cards)
				.innerJoin(decks, eq(cards.deckId, decks.id))
				.where(and(eq(cards.id, logData.cardId), eq(decks.userId, userId)));

			if (cardCheck.length === 0) {
				// Card doesn't belong to user, skip
				continue;
			}

			// Check if review log already exists
			const existing = await db
				.select({ id: reviewLogs.id, syncVersion: reviewLogs.syncVersion })
				.from(reviewLogs)
				.where(eq(reviewLogs.id, logData.id));

			if (existing.length === 0) {
				// New review log - insert
				const [inserted] = await db
					.insert(reviewLogs)
					.values({
						id: logData.id,
						cardId: logData.cardId,
						userId,
						rating: logData.rating,
						state: logData.state,
						scheduledDays: logData.scheduledDays,
						elapsedDays: logData.elapsedDays,
						reviewedAt: new Date(logData.reviewedAt),
						durationMs: logData.durationMs,
						syncVersion: 1,
					})
					.returning({
						id: reviewLogs.id,
						syncVersion: reviewLogs.syncVersion,
					});

				if (inserted) {
					result.reviewLogs.push({
						id: inserted.id,
						syncVersion: inserted.syncVersion,
					});
				}
			} else {
				// Already exists, return current version
				const existingLog = existing[0];
				if (existingLog) {
					result.reviewLogs.push({
						id: existingLog.id,
						syncVersion: existingLog.syncVersion,
					});
				}
			}
		}

		// Process note types with Last-Write-Wins conflict resolution
		for (const noteTypeData of data.noteTypes) {
			const clientUpdatedAt = new Date(noteTypeData.updatedAt);

			// Check if note type exists and belongs to user
			const existing = await db
				.select({
					id: noteTypes.id,
					updatedAt: noteTypes.updatedAt,
					syncVersion: noteTypes.syncVersion,
				})
				.from(noteTypes)
				.where(
					and(eq(noteTypes.id, noteTypeData.id), eq(noteTypes.userId, userId)),
				);

			if (existing.length === 0) {
				// New note type - insert
				const [inserted] = await db
					.insert(noteTypes)
					.values({
						id: noteTypeData.id,
						userId,
						name: noteTypeData.name,
						frontTemplate: noteTypeData.frontTemplate,
						backTemplate: noteTypeData.backTemplate,
						isReversible: noteTypeData.isReversible,
						createdAt: new Date(noteTypeData.createdAt),
						updatedAt: clientUpdatedAt,
						deletedAt: noteTypeData.deletedAt
							? new Date(noteTypeData.deletedAt)
							: null,
						syncVersion: 1,
					})
					.returning({ id: noteTypes.id, syncVersion: noteTypes.syncVersion });

				if (inserted) {
					result.noteTypes.push({
						id: inserted.id,
						syncVersion: inserted.syncVersion,
					});
				}
			} else {
				const serverNoteType = existing[0];
				if (serverNoteType && clientUpdatedAt > serverNoteType.updatedAt) {
					// Client wins - update
					const [updated] = await db
						.update(noteTypes)
						.set({
							name: noteTypeData.name,
							frontTemplate: noteTypeData.frontTemplate,
							backTemplate: noteTypeData.backTemplate,
							isReversible: noteTypeData.isReversible,
							updatedAt: clientUpdatedAt,
							deletedAt: noteTypeData.deletedAt
								? new Date(noteTypeData.deletedAt)
								: null,
							syncVersion: sql`${noteTypes.syncVersion} + 1`,
						})
						.where(eq(noteTypes.id, noteTypeData.id))
						.returning({
							id: noteTypes.id,
							syncVersion: noteTypes.syncVersion,
						});

					if (updated) {
						result.noteTypes.push({
							id: updated.id,
							syncVersion: updated.syncVersion,
						});
					}
				} else if (serverNoteType) {
					// Server wins - mark as conflict
					result.conflicts.noteTypes.push(noteTypeData.id);
					result.noteTypes.push({
						id: serverNoteType.id,
						syncVersion: serverNoteType.syncVersion,
					});
				}
			}
		}

		// Process note field types with Last-Write-Wins conflict resolution
		for (const fieldTypeData of data.noteFieldTypes) {
			const clientUpdatedAt = new Date(fieldTypeData.updatedAt);

			// Verify parent note type belongs to user
			const noteTypeCheck = await db
				.select({ id: noteTypes.id })
				.from(noteTypes)
				.where(
					and(
						eq(noteTypes.id, fieldTypeData.noteTypeId),
						eq(noteTypes.userId, userId),
					),
				);

			if (noteTypeCheck.length === 0) {
				// Parent note type doesn't belong to user, skip
				continue;
			}

			// Check if note field type exists
			const existing = await db
				.select({
					id: noteFieldTypes.id,
					updatedAt: noteFieldTypes.updatedAt,
					syncVersion: noteFieldTypes.syncVersion,
				})
				.from(noteFieldTypes)
				.where(eq(noteFieldTypes.id, fieldTypeData.id));

			if (existing.length === 0) {
				// New note field type - insert
				const [inserted] = await db
					.insert(noteFieldTypes)
					.values({
						id: fieldTypeData.id,
						noteTypeId: fieldTypeData.noteTypeId,
						name: fieldTypeData.name,
						order: fieldTypeData.order,
						fieldType: fieldTypeData.fieldType,
						createdAt: new Date(fieldTypeData.createdAt),
						updatedAt: clientUpdatedAt,
						deletedAt: fieldTypeData.deletedAt
							? new Date(fieldTypeData.deletedAt)
							: null,
						syncVersion: 1,
					})
					.returning({
						id: noteFieldTypes.id,
						syncVersion: noteFieldTypes.syncVersion,
					});

				if (inserted) {
					result.noteFieldTypes.push({
						id: inserted.id,
						syncVersion: inserted.syncVersion,
					});
				}
			} else {
				const serverFieldType = existing[0];
				if (serverFieldType && clientUpdatedAt > serverFieldType.updatedAt) {
					// Client wins - update
					const [updated] = await db
						.update(noteFieldTypes)
						.set({
							noteTypeId: fieldTypeData.noteTypeId,
							name: fieldTypeData.name,
							order: fieldTypeData.order,
							fieldType: fieldTypeData.fieldType,
							updatedAt: clientUpdatedAt,
							deletedAt: fieldTypeData.deletedAt
								? new Date(fieldTypeData.deletedAt)
								: null,
							syncVersion: sql`${noteFieldTypes.syncVersion} + 1`,
						})
						.where(eq(noteFieldTypes.id, fieldTypeData.id))
						.returning({
							id: noteFieldTypes.id,
							syncVersion: noteFieldTypes.syncVersion,
						});

					if (updated) {
						result.noteFieldTypes.push({
							id: updated.id,
							syncVersion: updated.syncVersion,
						});
					}
				} else if (serverFieldType) {
					// Server wins - mark as conflict
					result.conflicts.noteFieldTypes.push(fieldTypeData.id);
					result.noteFieldTypes.push({
						id: serverFieldType.id,
						syncVersion: serverFieldType.syncVersion,
					});
				}
			}
		}

		// Process notes with Last-Write-Wins conflict resolution
		for (const noteData of data.notes) {
			const clientUpdatedAt = new Date(noteData.updatedAt);

			// Verify parent deck belongs to user
			const deckCheck = await db
				.select({ id: decks.id })
				.from(decks)
				.where(and(eq(decks.id, noteData.deckId), eq(decks.userId, userId)));

			if (deckCheck.length === 0) {
				// Parent deck doesn't belong to user, skip
				continue;
			}

			// Check if note exists
			const existing = await db
				.select({
					id: notes.id,
					updatedAt: notes.updatedAt,
					syncVersion: notes.syncVersion,
				})
				.from(notes)
				.where(eq(notes.id, noteData.id));

			if (existing.length === 0) {
				// New note - insert
				const [inserted] = await db
					.insert(notes)
					.values({
						id: noteData.id,
						deckId: noteData.deckId,
						noteTypeId: noteData.noteTypeId,
						createdAt: new Date(noteData.createdAt),
						updatedAt: clientUpdatedAt,
						deletedAt: noteData.deletedAt ? new Date(noteData.deletedAt) : null,
						syncVersion: 1,
					})
					.returning({ id: notes.id, syncVersion: notes.syncVersion });

				if (inserted) {
					result.notes.push({
						id: inserted.id,
						syncVersion: inserted.syncVersion,
					});
				}
			} else {
				const serverNote = existing[0];
				if (serverNote && clientUpdatedAt > serverNote.updatedAt) {
					// Client wins - update
					const [updated] = await db
						.update(notes)
						.set({
							deckId: noteData.deckId,
							noteTypeId: noteData.noteTypeId,
							updatedAt: clientUpdatedAt,
							deletedAt: noteData.deletedAt
								? new Date(noteData.deletedAt)
								: null,
							syncVersion: sql`${notes.syncVersion} + 1`,
						})
						.where(eq(notes.id, noteData.id))
						.returning({ id: notes.id, syncVersion: notes.syncVersion });

					if (updated) {
						result.notes.push({
							id: updated.id,
							syncVersion: updated.syncVersion,
						});
					}
				} else if (serverNote) {
					// Server wins - mark as conflict
					result.conflicts.notes.push(noteData.id);
					result.notes.push({
						id: serverNote.id,
						syncVersion: serverNote.syncVersion,
					});
				}
			}
		}

		// Process note field values with Last-Write-Wins conflict resolution
		for (const fieldValueData of data.noteFieldValues) {
			const clientUpdatedAt = new Date(fieldValueData.updatedAt);

			// Verify parent note belongs to user (via deck ownership)
			const noteCheck = await db
				.select({ id: notes.id })
				.from(notes)
				.innerJoin(decks, eq(notes.deckId, decks.id))
				.where(
					and(eq(notes.id, fieldValueData.noteId), eq(decks.userId, userId)),
				);

			if (noteCheck.length === 0) {
				// Parent note doesn't belong to user, skip
				continue;
			}

			// Check if note field value exists
			const existing = await db
				.select({
					id: noteFieldValues.id,
					updatedAt: noteFieldValues.updatedAt,
					syncVersion: noteFieldValues.syncVersion,
				})
				.from(noteFieldValues)
				.where(eq(noteFieldValues.id, fieldValueData.id));

			if (existing.length === 0) {
				// New note field value - insert
				const [inserted] = await db
					.insert(noteFieldValues)
					.values({
						id: fieldValueData.id,
						noteId: fieldValueData.noteId,
						noteFieldTypeId: fieldValueData.noteFieldTypeId,
						value: fieldValueData.value,
						createdAt: new Date(fieldValueData.createdAt),
						updatedAt: clientUpdatedAt,
						syncVersion: 1,
					})
					.returning({
						id: noteFieldValues.id,
						syncVersion: noteFieldValues.syncVersion,
					});

				if (inserted) {
					result.noteFieldValues.push({
						id: inserted.id,
						syncVersion: inserted.syncVersion,
					});
				}
			} else {
				const serverFieldValue = existing[0];
				if (serverFieldValue && clientUpdatedAt > serverFieldValue.updatedAt) {
					// Client wins - update
					const [updated] = await db
						.update(noteFieldValues)
						.set({
							noteId: fieldValueData.noteId,
							noteFieldTypeId: fieldValueData.noteFieldTypeId,
							value: fieldValueData.value,
							updatedAt: clientUpdatedAt,
							syncVersion: sql`${noteFieldValues.syncVersion} + 1`,
						})
						.where(eq(noteFieldValues.id, fieldValueData.id))
						.returning({
							id: noteFieldValues.id,
							syncVersion: noteFieldValues.syncVersion,
						});

					if (updated) {
						result.noteFieldValues.push({
							id: updated.id,
							syncVersion: updated.syncVersion,
						});
					}
				} else if (serverFieldValue) {
					// Server wins - mark as conflict
					result.conflicts.noteFieldValues.push(fieldValueData.id);
					result.noteFieldValues.push({
						id: serverFieldValue.id,
						syncVersion: serverFieldValue.syncVersion,
					});
				}
			}
		}

		return result;
	},

	async pullChanges(
		userId: string,
		query: SyncPullQuery,
	): Promise<SyncPullResult> {
		const { lastSyncVersion } = query;

		// Get all decks with syncVersion > lastSyncVersion
		const pulledDecks = await db
			.select()
			.from(decks)
			.where(
				and(eq(decks.userId, userId), gt(decks.syncVersion, lastSyncVersion)),
			);

		// Get all cards from user's decks with syncVersion > lastSyncVersion
		const userDeckIds = await db
			.select({ id: decks.id })
			.from(decks)
			.where(eq(decks.userId, userId));

		const deckIdList = userDeckIds.map((d) => d.id);

		let pulledCards: Card[] = [];
		if (deckIdList.length > 0) {
			const cardResults = await db
				.select()
				.from(cards)
				.where(gt(cards.syncVersion, lastSyncVersion));

			// Filter cards that belong to user's decks
			pulledCards = cardResults.filter((c) => deckIdList.includes(c.deckId));
		}

		// Get all review logs for user with syncVersion > lastSyncVersion
		const pulledReviewLogs = await db
			.select()
			.from(reviewLogs)
			.where(
				and(
					eq(reviewLogs.userId, userId),
					gt(reviewLogs.syncVersion, lastSyncVersion),
				),
			);

		// Get all note types for user with syncVersion > lastSyncVersion
		const pulledNoteTypes = await db
			.select()
			.from(noteTypes)
			.where(
				and(
					eq(noteTypes.userId, userId),
					gt(noteTypes.syncVersion, lastSyncVersion),
				),
			);

		// Get user's note type IDs for filtering note field types
		const userNoteTypeIds = await db
			.select({ id: noteTypes.id })
			.from(noteTypes)
			.where(eq(noteTypes.userId, userId));

		const noteTypeIdList = userNoteTypeIds.map((nt) => nt.id);

		// Get all note field types for user's note types with syncVersion > lastSyncVersion
		let pulledNoteFieldTypes: NoteFieldType[] = [];
		if (noteTypeIdList.length > 0) {
			const fieldTypeResults = await db
				.select()
				.from(noteFieldTypes)
				.where(gt(noteFieldTypes.syncVersion, lastSyncVersion));

			pulledNoteFieldTypes = fieldTypeResults.filter((ft) =>
				noteTypeIdList.includes(ft.noteTypeId),
			);
		}

		// Get all notes for user's decks with syncVersion > lastSyncVersion
		let pulledNotes: Note[] = [];
		if (deckIdList.length > 0) {
			const noteResults = await db
				.select()
				.from(notes)
				.where(gt(notes.syncVersion, lastSyncVersion));

			pulledNotes = noteResults.filter((n) => deckIdList.includes(n.deckId));
		}

		// Get all user's note IDs (not just recently synced ones) for field value filtering
		let allUserNoteIds: string[] = [];
		if (deckIdList.length > 0) {
			const allNotes = await db
				.select({ id: notes.id })
				.from(notes)
				.innerJoin(decks, eq(notes.deckId, decks.id))
				.where(eq(decks.userId, userId));
			allUserNoteIds = allNotes.map((n) => n.id);
		}

		// Get all note field values for user's notes with syncVersion > lastSyncVersion
		let pulledNoteFieldValues: NoteFieldValue[] = [];
		if (allUserNoteIds.length > 0) {
			const fieldValueResults = await db
				.select()
				.from(noteFieldValues)
				.where(gt(noteFieldValues.syncVersion, lastSyncVersion));

			pulledNoteFieldValues = fieldValueResults.filter((fv) =>
				allUserNoteIds.includes(fv.noteId),
			);
		}

		// Calculate current max sync version across all entities
		let currentSyncVersion = lastSyncVersion;

		for (const deck of pulledDecks) {
			if (deck.syncVersion > currentSyncVersion) {
				currentSyncVersion = deck.syncVersion;
			}
		}
		for (const card of pulledCards) {
			if (card.syncVersion > currentSyncVersion) {
				currentSyncVersion = card.syncVersion;
			}
		}
		for (const log of pulledReviewLogs) {
			if (log.syncVersion > currentSyncVersion) {
				currentSyncVersion = log.syncVersion;
			}
		}
		for (const noteType of pulledNoteTypes) {
			if (noteType.syncVersion > currentSyncVersion) {
				currentSyncVersion = noteType.syncVersion;
			}
		}
		for (const fieldType of pulledNoteFieldTypes) {
			if (fieldType.syncVersion > currentSyncVersion) {
				currentSyncVersion = fieldType.syncVersion;
			}
		}
		for (const note of pulledNotes) {
			if (note.syncVersion > currentSyncVersion) {
				currentSyncVersion = note.syncVersion;
			}
		}
		for (const fieldValue of pulledNoteFieldValues) {
			if (fieldValue.syncVersion > currentSyncVersion) {
				currentSyncVersion = fieldValue.syncVersion;
			}
		}

		return {
			decks: pulledDecks,
			cards: pulledCards,
			reviewLogs: pulledReviewLogs,
			noteTypes: pulledNoteTypes,
			noteFieldTypes: pulledNoteFieldTypes,
			notes: pulledNotes,
			noteFieldValues: pulledNoteFieldValues,
			currentSyncVersion,
		};
	},
};
