import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	LocalCard,
	LocalDeck,
	LocalNote,
	LocalNoteFieldType,
	LocalNoteFieldValue,
	LocalNoteType,
	LocalReviewLog,
} from "../../db/index";
import { CardState, Rating } from "../../db/index";
import {
	crdtCardRepository,
	crdtDeckRepository,
	crdtNoteFieldTypeRepository,
	crdtNoteFieldValueRepository,
	crdtNoteRepository,
	crdtNoteTypeRepository,
	crdtReviewLogRepository,
} from "./repositories";
import { crdtSyncDb, crdtSyncStateManager } from "./sync-state";
import { CrdtEntityType } from "./types";

// Mock Dexie databases
vi.mock("../../db/index", async () => {
	const actual =
		await vi.importActual<typeof import("../../db/index")>("../../db/index");
	return {
		...actual,
		db: {
			decks: {
				toArray: vi.fn(),
				count: vi.fn(),
				offset: vi.fn(),
			},
			noteTypes: {
				toArray: vi.fn(),
				count: vi.fn(),
				offset: vi.fn(),
			},
			noteFieldTypes: {
				toArray: vi.fn(),
				count: vi.fn(),
				offset: vi.fn(),
			},
			notes: {
				toArray: vi.fn(),
				count: vi.fn(),
				offset: vi.fn(),
			},
			noteFieldValues: {
				toArray: vi.fn(),
				count: vi.fn(),
				offset: vi.fn(),
			},
			cards: {
				toArray: vi.fn(),
				count: vi.fn(),
				offset: vi.fn(),
			},
			reviewLogs: {
				toArray: vi.fn(),
				count: vi.fn(),
				offset: vi.fn(),
			},
		},
	};
});

vi.mock("./sync-state", async () => {
	const actual =
		await vi.importActual<typeof import("./sync-state")>("./sync-state");
	return {
		...actual,
		crdtSyncDb: {
			metadata: {
				get: vi.fn(),
				put: vi.fn(),
				delete: vi.fn(),
			},
			syncState: {
				clear: vi.fn(),
			},
		},
		crdtSyncStateManager: {
			setDocumentBinary: vi.fn(),
			batchSetDocuments: vi.fn(),
			clearAll: vi.fn(),
		},
	};
});

// Get mocked db
import { db } from "../../db/index";
// Import the module under test after mocks are set up
import {
	clearAllCrdtState,
	getMigrationStatus,
	isMigrationCompleted,
	MIGRATION_VERSION,
	resetMigration,
	runMigration,
	runMigrationWithBatching,
} from "./migration";

describe("migration", () => {
	const mockDeck: LocalDeck = {
		id: "deck-1",
		userId: "user-1",
		name: "Test Deck",
		description: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		syncVersion: 1,
		_synced: true,
	};

	const mockNoteType: LocalNoteType = {
		id: "note-type-1",
		userId: "user-1",
		name: "Basic",
		frontTemplate: "{{Front}}",
		backTemplate: "{{Back}}",
		isReversible: false,
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		syncVersion: 1,
		_synced: true,
	};

	const mockNoteFieldType: LocalNoteFieldType = {
		id: "field-type-1",
		noteTypeId: "note-type-1",
		name: "Front",
		order: 0,
		fieldType: "text",
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		syncVersion: 1,
		_synced: true,
	};

	const mockNote: LocalNote = {
		id: "note-1",
		deckId: "deck-1",
		noteTypeId: "note-type-1",
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		syncVersion: 1,
		_synced: true,
	};

	const mockNoteFieldValue: LocalNoteFieldValue = {
		id: "field-value-1",
		noteId: "note-1",
		noteFieldTypeId: "field-type-1",
		value: "Hello",
		createdAt: new Date(),
		updatedAt: new Date(),
		syncVersion: 1,
		_synced: true,
	};

	const mockCard: LocalCard = {
		id: "card-1",
		deckId: "deck-1",
		noteId: "note-1",
		isReversed: false,
		front: "Front",
		back: "Back",
		state: CardState.New,
		due: new Date(),
		stability: 0,
		difficulty: 0,
		elapsedDays: 0,
		scheduledDays: 0,
		reps: 0,
		lapses: 0,
		lastReview: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		syncVersion: 1,
		_synced: true,
	};

	const mockReviewLog: LocalReviewLog = {
		id: "review-1",
		cardId: "card-1",
		userId: "user-1",
		rating: Rating.Good,
		state: CardState.Learning,
		scheduledDays: 1,
		elapsedDays: 0,
		reviewedAt: new Date(),
		durationMs: 1000,
		syncVersion: 1,
		_synced: true,
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Default mock implementations for empty database
		vi.mocked(db.decks.toArray).mockResolvedValue([]);
		vi.mocked(db.noteTypes.toArray).mockResolvedValue([]);
		vi.mocked(db.noteFieldTypes.toArray).mockResolvedValue([]);
		vi.mocked(db.notes.toArray).mockResolvedValue([]);
		vi.mocked(db.noteFieldValues.toArray).mockResolvedValue([]);
		vi.mocked(db.cards.toArray).mockResolvedValue([]);
		vi.mocked(db.reviewLogs.toArray).mockResolvedValue([]);

		// Default: no existing migration
		vi.mocked(crdtSyncDb.metadata.get).mockResolvedValue(undefined);
	});

	describe("isMigrationCompleted", () => {
		it("should return false when no migration status exists", async () => {
			vi.mocked(crdtSyncDb.metadata.get).mockResolvedValue(undefined);

			const result = await isMigrationCompleted();
			expect(result).toBe(false);
		});

		it("should return true when migration is completed", async () => {
			vi.mocked(crdtSyncDb.metadata.get).mockResolvedValue({
				key: "crdt-migration-status",
				lastSyncAt: Date.now(),
				syncVersionWatermark: MIGRATION_VERSION,
				actorId: JSON.stringify({
					version: MIGRATION_VERSION,
					completedAt: Date.now(),
					counts: {
						decks: 0,
						noteTypes: 0,
						noteFieldTypes: 0,
						notes: 0,
						noteFieldValues: 0,
						cards: 0,
						reviewLogs: 0,
					},
				}),
			});

			const result = await isMigrationCompleted();
			expect(result).toBe(true);
		});

		it("should return false when migration version is outdated", async () => {
			vi.mocked(crdtSyncDb.metadata.get).mockResolvedValue({
				key: "crdt-migration-status",
				lastSyncAt: Date.now(),
				syncVersionWatermark: 0,
				actorId: JSON.stringify({
					version: 0, // Older version
					completedAt: Date.now(),
					counts: {
						decks: 0,
						noteTypes: 0,
						noteFieldTypes: 0,
						notes: 0,
						noteFieldValues: 0,
						cards: 0,
						reviewLogs: 0,
					},
				}),
			});

			const result = await isMigrationCompleted();
			expect(result).toBe(false);
		});
	});

	describe("getMigrationStatus", () => {
		it("should return null when no status exists", async () => {
			vi.mocked(crdtSyncDb.metadata.get).mockResolvedValue(undefined);

			const result = await getMigrationStatus();
			expect(result).toBeNull();
		});

		it("should return parsed status when exists", async () => {
			const expectedStatus = {
				version: MIGRATION_VERSION,
				completedAt: 1234567890,
				counts: {
					decks: 5,
					noteTypes: 2,
					noteFieldTypes: 4,
					notes: 10,
					noteFieldValues: 20,
					cards: 15,
					reviewLogs: 50,
				},
			};

			vi.mocked(crdtSyncDb.metadata.get).mockResolvedValue({
				key: "crdt-migration-status",
				lastSyncAt: expectedStatus.completedAt,
				syncVersionWatermark: expectedStatus.version,
				actorId: JSON.stringify(expectedStatus),
			});

			const result = await getMigrationStatus();
			expect(result).toEqual(expectedStatus);
		});

		it("should return null for invalid JSON", async () => {
			vi.mocked(crdtSyncDb.metadata.get).mockResolvedValue({
				key: "crdt-migration-status",
				lastSyncAt: 0,
				syncVersionWatermark: 0,
				actorId: "invalid json",
			});

			const result = await getMigrationStatus();
			expect(result).toBeNull();
		});
	});

	describe("runMigration", () => {
		it("should skip migration if already completed", async () => {
			const existingStatus = {
				version: MIGRATION_VERSION,
				completedAt: Date.now(),
				counts: {
					decks: 1,
					noteTypes: 0,
					noteFieldTypes: 0,
					notes: 0,
					noteFieldValues: 0,
					cards: 0,
					reviewLogs: 0,
				},
			};

			vi.mocked(crdtSyncDb.metadata.get).mockResolvedValue({
				key: "crdt-migration-status",
				lastSyncAt: existingStatus.completedAt,
				syncVersionWatermark: existingStatus.version,
				actorId: JSON.stringify(existingStatus),
			});

			const result = await runMigration();

			expect(result.wasRun).toBe(false);
			expect(result.status).toEqual(existingStatus);
			expect(crdtSyncStateManager.setDocumentBinary).not.toHaveBeenCalled();
		});

		it("should migrate all entity types", async () => {
			vi.mocked(db.decks.toArray).mockResolvedValue([mockDeck]);
			vi.mocked(db.noteTypes.toArray).mockResolvedValue([mockNoteType]);
			vi.mocked(db.noteFieldTypes.toArray).mockResolvedValue([
				mockNoteFieldType,
			]);
			vi.mocked(db.notes.toArray).mockResolvedValue([mockNote]);
			vi.mocked(db.noteFieldValues.toArray).mockResolvedValue([
				mockNoteFieldValue,
			]);
			vi.mocked(db.cards.toArray).mockResolvedValue([mockCard]);
			vi.mocked(db.reviewLogs.toArray).mockResolvedValue([mockReviewLog]);

			const result = await runMigration();

			expect(result.wasRun).toBe(true);
			expect(result.status).toBeDefined();
			expect(result.status?.counts).toEqual({
				decks: 1,
				noteTypes: 1,
				noteFieldTypes: 1,
				notes: 1,
				noteFieldValues: 1,
				cards: 1,
				reviewLogs: 1,
			});

			// Verify all entity types were migrated
			expect(crdtSyncStateManager.setDocumentBinary).toHaveBeenCalledTimes(7);
		});

		it("should call setDocumentBinary with correct parameters for deck", async () => {
			vi.mocked(db.decks.toArray).mockResolvedValue([mockDeck]);

			await runMigration();

			expect(crdtSyncStateManager.setDocumentBinary).toHaveBeenCalledWith(
				CrdtEntityType.Deck,
				mockDeck.id,
				expect.any(Uint8Array),
				mockDeck.syncVersion,
			);
		});

		it("should save migration status on success", async () => {
			await runMigration();

			expect(crdtSyncDb.metadata.put).toHaveBeenCalledWith(
				expect.objectContaining({
					key: "crdt-migration-status",
					syncVersionWatermark: MIGRATION_VERSION,
				}),
			);
		});

		it("should handle errors gracefully", async () => {
			const error = new Error("Database error");
			vi.mocked(db.decks.toArray).mockRejectedValue(error);

			const result = await runMigration();

			expect(result.wasRun).toBe(true);
			expect(result.status).toBeNull();
			expect(result.error).toBe(error);
		});
	});

	describe("runMigrationWithBatching", () => {
		it("should skip migration if already completed", async () => {
			const existingStatus = {
				version: MIGRATION_VERSION,
				completedAt: Date.now(),
				counts: {
					decks: 0,
					noteTypes: 0,
					noteFieldTypes: 0,
					notes: 0,
					noteFieldValues: 0,
					cards: 0,
					reviewLogs: 0,
				},
			};

			vi.mocked(crdtSyncDb.metadata.get).mockResolvedValue({
				key: "crdt-migration-status",
				lastSyncAt: existingStatus.completedAt,
				syncVersionWatermark: existingStatus.version,
				actorId: JSON.stringify(existingStatus),
			});

			const result = await runMigrationWithBatching(10);

			expect(result.wasRun).toBe(false);
			expect(result.status).toEqual(existingStatus);
		});

		it("should process entities in batches", async () => {
			// Create 3 decks to test batching
			const decks = [
				{ ...mockDeck, id: "deck-1" },
				{ ...mockDeck, id: "deck-2" },
				{ ...mockDeck, id: "deck-3" },
			];

			// Mock the offset/limit chain for batching
			let callCount = 0;
			const mockOffset = vi.fn().mockImplementation(() => ({
				limit: vi.fn().mockImplementation((limit: number) => ({
					toArray: vi.fn().mockImplementation(() => {
						const start = callCount * limit;
						callCount++;
						return Promise.resolve(decks.slice(start, start + limit));
					}),
				})),
			}));

			// biome-ignore lint/suspicious/noExplicitAny: Test mock
			(db.decks as any).offset = mockOffset;
			vi.mocked(db.decks.count).mockResolvedValue(3);

			// Empty arrays for other entity types
			const emptyOffset = vi.fn().mockReturnValue({
				limit: vi.fn().mockReturnValue({
					toArray: vi.fn().mockResolvedValue([]),
				}),
			});

			for (const table of [
				db.noteTypes,
				db.noteFieldTypes,
				db.notes,
				db.noteFieldValues,
				db.cards,
				db.reviewLogs,
			]) {
				// biome-ignore lint/suspicious/noExplicitAny: Test mock
				(table as any).offset = emptyOffset;
				vi.mocked(table.count).mockResolvedValue(0);
			}

			const result = await runMigrationWithBatching(2); // Batch size of 2

			expect(result.wasRun).toBe(true);
			expect(result.status?.counts.decks).toBe(3);

			// Should have called batchSetDocuments for deck batches
			expect(crdtSyncStateManager.batchSetDocuments).toHaveBeenCalled();
		});

		it("should call progress callback", async () => {
			const deck = { ...mockDeck, id: "deck-1" };

			let callCount = 0;
			const mockOffset = vi.fn().mockReturnValue({
				limit: vi.fn().mockReturnValue({
					toArray: vi.fn().mockImplementation(() => {
						if (callCount === 0) {
							callCount++;
							return Promise.resolve([deck]);
						}
						return Promise.resolve([]);
					}),
				}),
			});

			// biome-ignore lint/suspicious/noExplicitAny: Test mock
			(db.decks as any).offset = mockOffset;
			vi.mocked(db.decks.count).mockResolvedValue(1);

			// Empty arrays for other entity types
			const emptyOffset = vi.fn().mockReturnValue({
				limit: vi.fn().mockReturnValue({
					toArray: vi.fn().mockResolvedValue([]),
				}),
			});

			for (const table of [
				db.noteTypes,
				db.noteFieldTypes,
				db.notes,
				db.noteFieldValues,
				db.cards,
				db.reviewLogs,
			]) {
				// biome-ignore lint/suspicious/noExplicitAny: Test mock
				(table as any).offset = emptyOffset;
				vi.mocked(table.count).mockResolvedValue(0);
			}

			const progressCallback = vi.fn();
			await runMigrationWithBatching(10, progressCallback);

			expect(progressCallback).toHaveBeenCalledWith(
				expect.objectContaining({
					entityType: "deck",
					percentage: expect.any(Number),
				}),
			);
		});
	});

	describe("resetMigration", () => {
		it("should delete migration status", async () => {
			await resetMigration();

			expect(crdtSyncDb.metadata.delete).toHaveBeenCalledWith(
				"crdt-migration-status",
			);
		});
	});

	describe("clearAllCrdtState", () => {
		it("should clear all sync state", async () => {
			await clearAllCrdtState();

			expect(crdtSyncStateManager.clearAll).toHaveBeenCalled();
		});
	});

	describe("CRDT document conversion", () => {
		it("should convert deck to valid CRDT binary", () => {
			const { binary, documentId } =
				crdtDeckRepository.toCrdtDocument(mockDeck);

			expect(binary).toBeInstanceOf(Uint8Array);
			expect(binary.length).toBeGreaterThan(0);
			expect(documentId).toBe(`deck:${mockDeck.id}`);
		});

		it("should convert noteType to valid CRDT binary", () => {
			const { binary, documentId } =
				crdtNoteTypeRepository.toCrdtDocument(mockNoteType);

			expect(binary).toBeInstanceOf(Uint8Array);
			expect(binary.length).toBeGreaterThan(0);
			expect(documentId).toBe(`noteType:${mockNoteType.id}`);
		});

		it("should convert noteFieldType to valid CRDT binary", () => {
			const { binary, documentId } =
				crdtNoteFieldTypeRepository.toCrdtDocument(mockNoteFieldType);

			expect(binary).toBeInstanceOf(Uint8Array);
			expect(binary.length).toBeGreaterThan(0);
			expect(documentId).toBe(`noteFieldType:${mockNoteFieldType.id}`);
		});

		it("should convert note to valid CRDT binary", () => {
			const { binary, documentId } =
				crdtNoteRepository.toCrdtDocument(mockNote);

			expect(binary).toBeInstanceOf(Uint8Array);
			expect(binary.length).toBeGreaterThan(0);
			expect(documentId).toBe(`note:${mockNote.id}`);
		});

		it("should convert noteFieldValue to valid CRDT binary", () => {
			const { binary, documentId } =
				crdtNoteFieldValueRepository.toCrdtDocument(mockNoteFieldValue);

			expect(binary).toBeInstanceOf(Uint8Array);
			expect(binary.length).toBeGreaterThan(0);
			expect(documentId).toBe(`noteFieldValue:${mockNoteFieldValue.id}`);
		});

		it("should convert card to valid CRDT binary", () => {
			const { binary, documentId } =
				crdtCardRepository.toCrdtDocument(mockCard);

			expect(binary).toBeInstanceOf(Uint8Array);
			expect(binary.length).toBeGreaterThan(0);
			expect(documentId).toBe(`card:${mockCard.id}`);
		});

		it("should convert reviewLog to valid CRDT binary", () => {
			const { binary, documentId } =
				crdtReviewLogRepository.toCrdtDocument(mockReviewLog);

			expect(binary).toBeInstanceOf(Uint8Array);
			expect(binary.length).toBeGreaterThan(0);
			expect(documentId).toBe(`reviewLog:${mockReviewLog.id}`);
		});
	});
});
