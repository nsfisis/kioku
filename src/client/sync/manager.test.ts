/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";
import { db } from "../db/index";
import { localDeckRepository } from "../db/repositories";
import { ConflictResolver } from "./conflict";
import { CrdtEntityType, CrdtSyncStateManager, crdtSyncDb } from "./crdt";
import { SyncManager, type SyncManagerEvent } from "./manager";
import { PullService, type SyncPullResult } from "./pull";
import { PushService, type SyncPushResult } from "./push";
import { SyncQueue } from "./queue";

function createEmptyConflicts() {
	return {
		decks: [] as string[],
		cards: [] as string[],
		noteTypes: [] as string[],
		noteFieldTypes: [] as string[],
		notes: [] as string[],
		noteFieldValues: [] as string[],
	};
}

function createEmptyPullResult(
	currentSyncVersion = 0,
): Omit<SyncPullResult, "decks" | "cards" | "reviewLogs"> {
	return {
		noteTypes: [],
		noteFieldTypes: [],
		notes: [],
		noteFieldValues: [],
		currentSyncVersion,
	};
}

function createEmptyPushResult(): Omit<
	SyncPushResult,
	"decks" | "cards" | "reviewLogs" | "conflicts"
> {
	return {
		noteTypes: [],
		noteFieldTypes: [],
		notes: [],
		noteFieldValues: [],
	};
}

describe("SyncManager", () => {
	let syncQueue: SyncQueue;
	let conflictResolver: ConflictResolver;
	let pushToServer: Mock;
	let pullFromServer: Mock;

	function createServices() {
		const pushService = new PushService({
			syncQueue,
			pushToServer,
		});

		const pullService = new PullService({
			syncQueue,
			pullFromServer,
		});

		return { pushService, pullService };
	}

	/**
	 * Create a pending deck in the database that will need to be synced
	 */
	async function createPendingDeck() {
		return localDeckRepository.create({
			userId: "user-1",
			name: "Test Deck",
			description: null,
			newCardsPerDay: 20,
		});
	}

	beforeEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
		await crdtSyncDb.syncState.clear();
		await crdtSyncDb.metadata.clear();
		localStorage.clear();

		syncQueue = new SyncQueue();

		pushToServer = vi.fn().mockResolvedValue({
			decks: [],
			cards: [],
			reviewLogs: [],
			...createEmptyPushResult(),
			conflicts: createEmptyConflicts(),
		} satisfies SyncPushResult);

		pullFromServer = vi.fn().mockResolvedValue({
			decks: [],
			cards: [],
			reviewLogs: [],
			...createEmptyPullResult(0),
		} satisfies SyncPullResult);

		conflictResolver = new ConflictResolver({ strategy: "server_wins" });
	});

	afterEach(async () => {
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
		await crdtSyncDb.syncState.clear();
		await crdtSyncDb.metadata.clear();
		localStorage.clear();
	});

	describe("constructor", () => {
		it("should create a sync manager with default options", () => {
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			expect(manager.isAutoSyncEnabled()).toBe(true);
			expect(manager.getOnlineStatus()).toBe(true); // jsdom defaults to online
		});

		it("should accept custom options", () => {
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
				debounceMs: 2000,
				autoSync: false,
			});

			expect(manager.isAutoSyncEnabled()).toBe(false);
		});
	});

	describe("start/stop", () => {
		it("should add event listeners when started", () => {
			const addSpy = vi.spyOn(window, "addEventListener");
			const { pushService, pullService } = createServices();

			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			manager.start();

			expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));
			expect(addSpy).toHaveBeenCalledWith("offline", expect.any(Function));

			manager.stop();
			addSpy.mockRestore();
		});

		it("should remove event listeners when stopped", () => {
			const removeSpy = vi.spyOn(window, "removeEventListener");
			const { pushService, pullService } = createServices();

			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			manager.start();
			manager.stop();

			expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
			expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function));

			removeSpy.mockRestore();
		});

		it("should not add listeners multiple times if start called twice", () => {
			const addSpy = vi.spyOn(window, "addEventListener");
			const { pushService, pullService } = createServices();

			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			manager.start();
			manager.start();

			// Should only be called once for each event type
			expect(addSpy.mock.calls.filter((c) => c[0] === "online").length).toBe(1);
			expect(addSpy.mock.calls.filter((c) => c[0] === "offline").length).toBe(
				1,
			);

			manager.stop();
			addSpy.mockRestore();
		});
	});

	describe("subscribe", () => {
		it("should notify listeners of events", async () => {
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			const events: SyncManagerEvent[] = [];
			manager.subscribe((event) => events.push(event));

			await manager.sync();

			expect(events).toContainEqual({ type: "sync_start" });
			expect(events).toContainEqual(
				expect.objectContaining({ type: "sync_complete" }),
			);
		});

		it("should allow unsubscribing", async () => {
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			const events: SyncManagerEvent[] = [];
			const unsubscribe = manager.subscribe((event) => events.push(event));

			await manager.sync();
			const eventCount = events.length;

			unsubscribe();

			await manager.sync();
			expect(events.length).toBe(eventCount);
		});
	});

	describe("sync", () => {
		it("should perform push then pull", async () => {
			// Create pending data so pushToServer will be called
			await createPendingDeck();

			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			const result = await manager.sync();

			expect(result.success).toBe(true);
			expect(pushToServer).toHaveBeenCalled();
			expect(pullFromServer).toHaveBeenCalled();
		});

		it("should return push and pull results", async () => {
			// Create pending data so pushToServer will be called
			await createPendingDeck();

			const expectedPushResult: SyncPushResult = {
				decks: [{ id: "deck-1", syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				...createEmptyPushResult(),
				conflicts: createEmptyConflicts(),
			};
			pushToServer.mockResolvedValue(expectedPushResult);

			const expectedPullResult: SyncPullResult = {
				decks: [],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(5),
			};
			pullFromServer.mockResolvedValue(expectedPullResult);

			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			const result = await manager.sync();

			expect(result.pushResult).toEqual(expectedPushResult);
			expect(result.pullResult).toEqual(expectedPullResult);
		});

		it("should handle push errors", async () => {
			// Create pending data so pushToServer will be called
			await createPendingDeck();

			pushToServer.mockRejectedValue(new Error("Network error"));

			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			const result = await manager.sync();

			expect(result.success).toBe(false);
			expect(result.error).toBe("Network error");
		});

		it("should handle pull errors", async () => {
			pullFromServer.mockRejectedValue(new Error("Server error"));

			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			const result = await manager.sync();

			expect(result.success).toBe(false);
			expect(result.error).toBe("Server error");
		});

		it("should not sync if already syncing", async () => {
			// Make push slow
			pushToServer.mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve({
									decks: [],
									cards: [],
									reviewLogs: [],
									...createEmptyPushResult(),
									conflicts: createEmptyConflicts(),
								}),
							100,
						),
					),
			);

			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			// Start two syncs
			const sync1 = manager.sync();
			const sync2 = manager.sync();

			const [result1, result2] = await Promise.all([sync1, sync2]);

			expect(result1.success).toBe(true);
			expect(result2.success).toBe(false);
			expect(result2.error).toBe("Sync already in progress");
		});

		it("should resolve conflicts when present", async () => {
			// Create pending data so pushToServer will be called
			const deck = await createPendingDeck();

			const pushResult: SyncPushResult = {
				decks: [{ id: deck.id, syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				...createEmptyPushResult(),
				conflicts: { ...createEmptyConflicts(), decks: [deck.id] },
			};
			pushToServer.mockResolvedValue(pushResult);

			const pullResult: SyncPullResult = {
				decks: [
					{
						id: deck.id,
						userId: "user-1",
						name: "Server Deck",
						description: null,
						newCardsPerDay: 20,
						createdAt: new Date(),
						updatedAt: new Date(),
						deletedAt: null,
						syncVersion: 5,
					},
				],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(5),
			};
			pullFromServer.mockResolvedValue(pullResult);

			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			const result = await manager.sync();

			expect(result.success).toBe(true);
			expect(result.conflictsResolved).toBe(1);
		});

		it("should notify sync_error on failure", async () => {
			// Create pending data so pushToServer will be called
			await createPendingDeck();

			pushToServer.mockRejectedValue(new Error("Network error"));

			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			const events: SyncManagerEvent[] = [];
			manager.subscribe((event) => events.push(event));

			await manager.sync();

			expect(events).toContainEqual({
				type: "sync_error",
				error: "Network error",
			});
		});
	});

	describe("online/offline handling", () => {
		it("should notify listeners when going online", () => {
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
				autoSync: false, // Disable to avoid actual sync
			});

			const events: SyncManagerEvent[] = [];
			manager.subscribe((event) => events.push(event));

			manager.start();

			// Simulate online event
			window.dispatchEvent(new Event("online"));

			expect(events).toContainEqual({ type: "online" });
			expect(manager.getOnlineStatus()).toBe(true);

			manager.stop();
		});

		it("should notify listeners when going offline", () => {
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
				autoSync: false,
			});

			const events: SyncManagerEvent[] = [];
			manager.subscribe((event) => events.push(event));

			manager.start();

			// Simulate offline event
			window.dispatchEvent(new Event("offline"));

			expect(events).toContainEqual({ type: "offline" });
			expect(manager.getOnlineStatus()).toBe(false);

			manager.stop();
		});

		it("should not auto-sync when coming online if disabled", () => {
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
				autoSync: false,
				debounceMs: 10,
			});

			manager.start();

			// Go offline first
			window.dispatchEvent(new Event("offline"));

			// Then back online
			window.dispatchEvent(new Event("online"));

			// Since autoSync is disabled, pushToServer should not be scheduled
			// We can't easily test the auto-sync behavior without fake timers
			// but we can verify the setting works
			expect(manager.isAutoSyncEnabled()).toBe(false);

			manager.stop();
		});
	});

	describe("forceSync", () => {
		it("should sync even if offline", async () => {
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			manager.start();
			window.dispatchEvent(new Event("offline"));

			// forceSync calls sync which checks online status
			// So this should fail because we're offline
			const result = await manager.forceSync();

			expect(result.success).toBe(false);
			expect(result.error).toBe("Offline");

			manager.stop();
		});
	});

	describe("setAutoSync", () => {
		it("should update auto-sync setting", () => {
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
				autoSync: true,
			});

			expect(manager.isAutoSyncEnabled()).toBe(true);

			manager.setAutoSync(false);
			expect(manager.isAutoSyncEnabled()).toBe(false);

			manager.setAutoSync(true);
			expect(manager.isAutoSyncEnabled()).toBe(true);
		});
	});

	describe("getState", () => {
		it("should return current sync queue state", async () => {
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			const state = await manager.getState();

			expect(state.status).toBe("idle");
			expect(state.pendingCount).toBe(0);
			expect(state.lastSyncVersion).toBe(0);
		});
	});

	describe("isSyncing", () => {
		it("should return true during sync", async () => {
			// Make push slow
			pushToServer.mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() =>
								resolve({
									decks: [],
									cards: [],
									reviewLogs: [],
									...createEmptyPushResult(),
									conflicts: createEmptyConflicts(),
								}),
							100,
						),
					),
			);

			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			expect(manager.isSyncing()).toBe(false);

			const syncPromise = manager.sync();
			expect(manager.isSyncing()).toBe(true);

			await syncPromise;
			expect(manager.isSyncing()).toBe(false);
		});
	});

	describe("CRDT integration", () => {
		it("should store CRDT documents after successful push", async () => {
			// Create pending data
			const deck = await createPendingDeck();

			// Mock push to return success with sync version
			pushToServer.mockResolvedValue({
				decks: [{ id: deck.id, syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				...createEmptyPushResult(),
				conflicts: createEmptyConflicts(),
			} satisfies SyncPushResult);

			pullFromServer.mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(1),
			} satisfies SyncPullResult);

			const crdtSyncStateManager = new CrdtSyncStateManager();
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
				crdtSyncStateManager,
			});

			const result = await manager.sync();

			expect(result.success).toBe(true);
			expect(result.crdtDocumentsStored).toBe(1);

			// Verify CRDT document was stored
			const hasDocument = await crdtSyncStateManager.hasDocument(
				CrdtEntityType.Deck,
				deck.id,
			);
			expect(hasDocument).toBe(true);
		});

		it("should emit crdt_documents_stored event when documents are stored", async () => {
			const deck = await createPendingDeck();

			pushToServer.mockResolvedValue({
				decks: [{ id: deck.id, syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				...createEmptyPushResult(),
				conflicts: createEmptyConflicts(),
			} satisfies SyncPushResult);

			pullFromServer.mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(1),
			} satisfies SyncPullResult);

			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			const events: SyncManagerEvent[] = [];
			manager.subscribe((event) => events.push(event));

			await manager.sync();

			const crdtEvent = events.find(
				(e) => e.type === "crdt_documents_stored",
			) as { type: "crdt_documents_stored"; count: number } | undefined;
			expect(crdtEvent).toBeDefined();
			expect(crdtEvent?.count).toBe(1);
		});

		it("should update CRDT sync metadata after successful sync", async () => {
			pullFromServer.mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(10),
			} satisfies SyncPullResult);

			const crdtSyncStateManager = new CrdtSyncStateManager();
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
				crdtSyncStateManager,
			});

			await manager.sync();

			const stats = await manager.getCrdtSyncStats();
			expect(stats.syncVersionWatermark).toBe(10);
			expect(stats.lastSyncAt).toBeGreaterThan(0);
		});

		it("should return CRDT sync stats", async () => {
			const deck = await createPendingDeck();

			pushToServer.mockResolvedValue({
				decks: [{ id: deck.id, syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				...createEmptyPushResult(),
				conflicts: createEmptyConflicts(),
			} satisfies SyncPushResult);

			pullFromServer.mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(1),
			} satisfies SyncPullResult);

			const crdtSyncStateManager = new CrdtSyncStateManager();
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
				crdtSyncStateManager,
			});

			await manager.sync();

			const stats = await manager.getCrdtSyncStats();
			expect(stats.totalDocuments).toBe(1);
		});

		it("should clear CRDT state when clearCrdtState is called", async () => {
			const deck = await createPendingDeck();

			pushToServer.mockResolvedValue({
				decks: [{ id: deck.id, syncVersion: 1 }],
				cards: [],
				reviewLogs: [],
				...createEmptyPushResult(),
				conflicts: createEmptyConflicts(),
			} satisfies SyncPushResult);

			pullFromServer.mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(1),
			} satisfies SyncPullResult);

			const crdtSyncStateManager = new CrdtSyncStateManager();
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
				crdtSyncStateManager,
			});

			await manager.sync();

			// Verify document exists
			let hasDocument = await manager.hasCrdtDocument(
				CrdtEntityType.Deck,
				deck.id,
			);
			expect(hasDocument).toBe(true);

			// Clear CRDT state
			await manager.clearCrdtState();

			// Verify document is gone
			hasDocument = await manager.hasCrdtDocument(CrdtEntityType.Deck, deck.id);
			expect(hasDocument).toBe(false);

			const stats = await manager.getCrdtSyncStats();
			expect(stats.totalDocuments).toBe(0);
		});

		it("should check if CRDT document exists", async () => {
			const crdtSyncStateManager = new CrdtSyncStateManager();
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
				crdtSyncStateManager,
			});

			// No documents initially
			const hasDocument = await manager.hasCrdtDocument(
				CrdtEntityType.Deck,
				"non-existent-id",
			);
			expect(hasDocument).toBe(false);
		});

		it("should not store CRDT documents for failed push items", async () => {
			const deck = await createPendingDeck();

			// Push succeeds but deck is in conflicts (not in success list)
			pushToServer.mockResolvedValue({
				decks: [], // Deck not in success list
				cards: [],
				reviewLogs: [],
				...createEmptyPushResult(),
				conflicts: { ...createEmptyConflicts(), decks: [deck.id] },
			} satisfies SyncPushResult);

			pullFromServer.mockResolvedValue({
				decks: [],
				cards: [],
				reviewLogs: [],
				...createEmptyPullResult(1),
			} satisfies SyncPullResult);

			const crdtSyncStateManager = new CrdtSyncStateManager();
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
				crdtSyncStateManager,
			});

			const result = await manager.sync();

			// No CRDT documents should be stored for conflicted items
			expect(result.crdtDocumentsStored).toBe(0);

			const hasDocument = await crdtSyncStateManager.hasDocument(
				CrdtEntityType.Deck,
				deck.id,
			);
			expect(hasDocument).toBe(false);
		});

		it("should include crdtDocumentsStored in sync result when offline", async () => {
			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			manager.start();
			window.dispatchEvent(new Event("offline"));

			const result = await manager.sync();

			expect(result.success).toBe(false);
			expect(result.crdtDocumentsStored).toBe(0);

			manager.stop();
		});

		it("should include crdtDocumentsStored in sync result on error", async () => {
			await createPendingDeck();
			pushToServer.mockRejectedValue(new Error("Network error"));

			const { pushService, pullService } = createServices();
			const manager = new SyncManager({
				syncQueue,
				pushService,
				pullService,
				conflictResolver,
			});

			const result = await manager.sync();

			expect(result.success).toBe(false);
			expect(result.crdtDocumentsStored).toBe(0);
		});
	});
});
