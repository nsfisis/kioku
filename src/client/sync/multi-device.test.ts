/**
 * Multi-device sync scenarios
 *
 * Drives the full client sync stack of two independent devices against an
 * in-memory server, to check what happens when both edit while offline.
 *
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import Dexie from "dexie";
import { IDBKeyRange as FakeIDBKeyRange, IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	ServerCard,
	ServerDeck,
	ServerNote,
	ServerNoteFieldType,
	ServerNoteFieldValue,
	ServerNoteType,
	ServerReviewLog,
	SyncPullResult,
} from "./pull";
import type { SyncPushData, SyncPushResult } from "./push";

/**
 * In-memory stand-in for the sync API.
 *
 * It mirrors the semantics of `src/server/repositories/sync.ts`: rows are
 * resolved with Last-Write-Wins on `updatedAt`, a conflict is reported only
 * when the stored row is the newer one, and review logs are append-only.
 *
 * One deliberate difference: `syncVersion` here is a single monotonic counter
 * shared by every row, which is what the `syncVersion > lastSyncVersion`
 * watermark used by pull actually assumes.
 */
class FakeSyncServer {
	readonly userId = "user-1";

	private version = 0;
	private decks = new Map<string, ServerDeck>();
	private noteTypes = new Map<string, ServerNoteType>();
	private noteFieldTypes = new Map<string, ServerNoteFieldType>();
	private notes = new Map<string, ServerNote>();
	private noteFieldValues = new Map<string, ServerNoteFieldValue>();
	private cards = new Map<string, ServerCard>();
	private reviewLogs = new Map<string, ServerReviewLog>();

	/** Rows the server accepted, in the order they were accepted */
	readonly acceptedPushes: string[] = [];

	async push(data: SyncPushData): Promise<SyncPushResult> {
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

		for (const noteType of data.noteTypes) {
			this.applyLww(
				this.noteTypes,
				{
					id: noteType.id,
					userId: this.userId,
					name: noteType.name,
					frontTemplate: noteType.frontTemplate,
					backTemplate: noteType.backTemplate,
					isReversible: noteType.isReversible,
					createdAt: new Date(noteType.createdAt),
					updatedAt: new Date(noteType.updatedAt),
					deletedAt: noteType.deletedAt ? new Date(noteType.deletedAt) : null,
				},
				result.noteTypes,
				result.conflicts.noteTypes,
			);
		}

		for (const fieldType of data.noteFieldTypes) {
			this.applyLww(
				this.noteFieldTypes,
				{
					id: fieldType.id,
					noteTypeId: fieldType.noteTypeId,
					name: fieldType.name,
					order: fieldType.order,
					fieldType: fieldType.fieldType,
					createdAt: new Date(fieldType.createdAt),
					updatedAt: new Date(fieldType.updatedAt),
					deletedAt: fieldType.deletedAt ? new Date(fieldType.deletedAt) : null,
				},
				result.noteFieldTypes,
				result.conflicts.noteFieldTypes,
			);
		}

		for (const deck of data.decks) {
			this.applyLww(
				this.decks,
				{
					id: deck.id,
					userId: this.userId,
					name: deck.name,
					description: deck.description,
					defaultNoteTypeId: deck.defaultNoteTypeId,
					createdAt: new Date(deck.createdAt),
					updatedAt: new Date(deck.updatedAt),
					deletedAt: deck.deletedAt ? new Date(deck.deletedAt) : null,
				},
				result.decks,
				result.conflicts.decks,
			);
		}

		for (const note of data.notes) {
			this.applyLww(
				this.notes,
				{
					id: note.id,
					deckId: note.deckId,
					noteTypeId: note.noteTypeId,
					createdAt: new Date(note.createdAt),
					updatedAt: new Date(note.updatedAt),
					deletedAt: note.deletedAt ? new Date(note.deletedAt) : null,
				},
				result.notes,
				result.conflicts.notes,
			);
		}

		for (const fieldValue of data.noteFieldValues) {
			this.applyLww(
				this.noteFieldValues,
				{
					id: fieldValue.id,
					noteId: fieldValue.noteId,
					noteFieldTypeId: fieldValue.noteFieldTypeId,
					value: fieldValue.value,
					createdAt: new Date(fieldValue.createdAt),
					updatedAt: new Date(fieldValue.updatedAt),
				},
				result.noteFieldValues,
				result.conflicts.noteFieldValues,
			);
		}

		for (const card of data.cards) {
			this.applyLww(
				this.cards,
				{
					id: card.id,
					deckId: card.deckId,
					noteId: card.noteId,
					isReversed: card.isReversed,
					front: card.front,
					back: card.back,
					state: card.state,
					due: new Date(card.due),
					stability: card.stability,
					difficulty: card.difficulty,
					elapsedDays: card.elapsedDays,
					scheduledDays: card.scheduledDays,
					reps: card.reps,
					lapses: card.lapses,
					lastReview: card.lastReview ? new Date(card.lastReview) : null,
					createdAt: new Date(card.createdAt),
					updatedAt: new Date(card.updatedAt),
					deletedAt: card.deletedAt ? new Date(card.deletedAt) : null,
				},
				result.cards,
				result.conflicts.cards,
			);
		}

		// Review logs are append-only: the first writer wins and later pushes of
		// the same ID are silently accepted as already-present.
		for (const log of data.reviewLogs) {
			const existing = this.reviewLogs.get(log.id);
			if (existing) {
				result.reviewLogs.push({
					id: existing.id,
					syncVersion: existing.syncVersion,
				});
				continue;
			}
			this.version += 1;
			this.reviewLogs.set(log.id, {
				id: log.id,
				cardId: log.cardId,
				userId: this.userId,
				rating: log.rating,
				state: log.state,
				scheduledDays: log.scheduledDays,
				elapsedDays: log.elapsedDays,
				reviewedAt: new Date(log.reviewedAt),
				durationMs: log.durationMs,
				syncVersion: this.version,
			});
			result.reviewLogs.push({ id: log.id, syncVersion: this.version });
		}

		return result;
	}

	async pull(lastSyncVersion: number): Promise<SyncPullResult> {
		const since = <T extends { syncVersion: number }>(store: Map<string, T>) =>
			[...store.values()].filter((row) => row.syncVersion > lastSyncVersion);

		return {
			decks: since(this.decks),
			cards: since(this.cards),
			reviewLogs: since(this.reviewLogs),
			noteTypes: since(this.noteTypes),
			noteFieldTypes: since(this.noteFieldTypes),
			notes: since(this.notes),
			noteFieldValues: since(this.noteFieldValues),
			currentSyncVersion: this.version,
		};
	}

	getDeck(id: string): ServerDeck | undefined {
		return this.decks.get(id);
	}

	getNoteFieldValue(id: string): ServerNoteFieldValue | undefined {
		return this.noteFieldValues.get(id);
	}

	private applyLww<
		T extends { id: string; updatedAt: Date; syncVersion: number },
	>(
		store: Map<string, T>,
		incoming: Omit<T, "syncVersion">,
		accepted: { id: string; syncVersion: number }[],
		conflicts: string[],
	): void {
		const existing = store.get(incoming.id);

		if (existing && incoming.updatedAt <= existing.updatedAt) {
			// Server row is the newer one: reject and report a conflict
			conflicts.push(incoming.id);
			accepted.push({ id: existing.id, syncVersion: existing.syncVersion });
			return;
		}

		this.version += 1;
		store.set(incoming.id, { ...incoming, syncVersion: this.version } as T);
		accepted.push({ id: incoming.id, syncVersion: this.version });
		this.acceptedPushes.push(incoming.id);
	}
}

/**
 * Spin up an isolated "device": its own IndexedDB backing store, its own copy
 * of the client modules (and therefore its own Dexie instance and sync queue),
 * wired to the shared fake server.
 *
 * Two things make the devices genuinely separate inside one process:
 * `vi.resetModules()` gives each device its own Dexie instance and sync queue,
 * and `Dexie.dependencies.indexedDB` is repointed at a fresh
 * `IDBFactory` first, because Dexie copies that dependency into every instance
 * it constructs.
 */
async function createDevice(name: string, server: FakeSyncServer) {
	const previousIndexedDB = Dexie.dependencies.indexedDB;
	Dexie.dependencies.indexedDB = new IDBFactory();
	Dexie.dependencies.IDBKeyRange = FakeIDBKeyRange;

	vi.resetModules();
	const dbModule = await import("../db/index");
	const repos = await import("../db/repositories");
	const queueModule = await import("./queue");
	const pushModule = await import("./push");
	const pullModule = await import("./pull");
	const conflictModule = await import("./conflict");
	const managerModule = await import("./manager");

	Dexie.dependencies.indexedDB = previousIndexedDB;

	const syncQueue = new queueModule.SyncQueue();
	const manager = new managerModule.SyncManager({
		syncQueue,
		pushService: new pushModule.PushService({
			syncQueue,
			pushToServer: (data) => server.push(data),
		}),
		pullService: new pullModule.PullService({
			syncQueue,
			pullFromServer: (lastSyncVersion) => server.pull(lastSyncVersion),
		}),
		conflictResolver: new conflictModule.ConflictResolver(),
		autoSync: false,
	});

	return {
		name,
		db: dbModule.db,
		repos,
		/** True while this device still has rows waiting to be pushed */
		hasPendingChanges() {
			return syncQueue.hasPendingChanges();
		},
		/** Come back online and run a full push/pull/resolve cycle */
		async sync() {
			const result = await manager.sync();
			if (!result.success) {
				throw new Error(`${name}: sync failed: ${result.error}`);
			}
			return result;
		},
		/**
		 * Force a row's `updatedAt`, so a test can decide which device holds the
		 * newer write instead of depending on wall-clock ordering.
		 */
		async setUpdatedAt(
			table: "decks" | "noteFieldValues",
			id: string,
			updatedAt: Date,
		) {
			await dbModule.db.table(table).update(id, { updatedAt });
		},
	};
}

type Device = Awaited<ReturnType<typeof createDevice>>;

/**
 * A timestamp guaranteed to be newer than anything written during setup, so a
 * test can decide which device holds the winning write.
 */
function laterThanSetup(offsetMs: number): Date {
	return new Date(Date.now() + 60_000 + offsetMs);
}

/**
 * Sync both devices until nothing is left to push and both have seen each
 * other's last push. Conflict resolution can itself produce a row that needs
 * pushing, so a fixed number of rounds is not enough.
 */
async function syncUntilConverged(a: Device, b: Device): Promise<void> {
	let settledRounds = 0;
	for (let round = 0; round < 8; round++) {
		await a.sync();
		await b.sync();
		const settled =
			!(await a.hasPendingChanges()) && !(await b.hasPendingChanges());
		// Two consecutive quiet rounds: the second one is what lets each device
		// pull whatever the other pushed during the round that went quiet.
		settledRounds = settled ? settledRounds + 1 : 0;
		if (settledRounds >= 2) return;
	}
	throw new Error("devices did not converge");
}

/** Create the note type + two text fields every note scenario needs */
async function seedNoteType(device: Device, userId: string) {
	const noteType = await device.repos.localNoteTypeRepository.create({
		userId,
		name: "Basic",
		frontTemplate: "{{Front}}",
		backTemplate: "{{Back}}",
		isReversible: false,
	});
	const front = await device.repos.localNoteFieldTypeRepository.create({
		noteTypeId: noteType.id,
		name: "Front",
		order: 0,
	});
	const back = await device.repos.localNoteFieldTypeRepository.create({
		noteTypeId: noteType.id,
		name: "Back",
		order: 1,
	});
	return { noteType, front, back };
}

describe("Multi-device sync scenarios", () => {
	let server: FakeSyncServer;
	let deviceA: Device;
	let deviceB: Device;

	beforeEach(async () => {
		localStorage.clear();
		server = new FakeSyncServer();
		// Both devices are constructed before anyone syncs, so neither inherits
		// the other's persisted sync watermark.
		deviceA = await createDevice("deviceA", server);
		deviceB = await createDevice("deviceB", server);
	});

	it("keeps both edits when two devices edit different fields of the same note", async () => {
		// Device A creates the note and publishes it
		const { noteType, front, back } = await seedNoteType(
			deviceA,
			server.userId,
		);
		const deck = await deviceA.repos.localDeckRepository.create({
			userId: server.userId,
			name: "Deck",
			description: null,
			defaultNoteTypeId: noteType.id,
		});
		const created = await deviceA.repos.localNoteRepository.createWithCards({
			deckId: deck.id,
			noteTypeId: noteType.id,
			fields: { Front: "original front", Back: "original back" },
		});
		await deviceA.sync();

		// Device B picks it up
		await deviceB.sync();
		const bValues =
			await deviceB.repos.localNoteFieldValueRepository.findByNoteId(
				created.note.id,
			);
		expect(bValues).toHaveLength(2);

		// Both go offline and edit a different field of the same note
		const aFront = created.fieldValues.find(
			(value) => value.noteFieldTypeId === front.id,
		);
		const bBack = bValues.find((value) => value.noteFieldTypeId === back.id);
		expect(aFront).toBeDefined();
		expect(bBack).toBeDefined();
		if (!aFront || !bBack) return;

		await deviceA.repos.localNoteFieldValueRepository.update(aFront.id, {
			value: "edited by A",
		});
		await deviceB.repos.localNoteFieldValueRepository.update(bBack.id, {
			value: "edited by B",
		});

		await syncUntilConverged(deviceA, deviceB);

		// Both edits survive on both devices: they touched different rows
		for (const device of [deviceA, deviceB]) {
			const values =
				await device.repos.localNoteFieldValueRepository.findByNoteId(
					created.note.id,
				);
			const byFieldType = new Map(
				values.map((value) => [value.noteFieldTypeId, value.value]),
			);
			expect(byFieldType.get(front.id)).toBe("edited by A");
			expect(byFieldType.get(back.id)).toBe("edited by B");
		}
	});

	it("keeps the newer edit when two devices edit the same field", async () => {
		const { noteType, front } = await seedNoteType(deviceA, server.userId);
		const deck = await deviceA.repos.localDeckRepository.create({
			userId: server.userId,
			name: "Deck",
			description: null,
			defaultNoteTypeId: noteType.id,
		});
		const created = await deviceA.repos.localNoteRepository.createWithCards({
			deckId: deck.id,
			noteTypeId: noteType.id,
			fields: { Front: "original", Back: "back" },
		});
		await deviceA.sync();
		await deviceB.sync();

		const fieldValueId = created.fieldValues.find(
			(value) => value.noteFieldTypeId === front.id,
		)?.id;
		expect(fieldValueId).toBeDefined();
		if (!fieldValueId) return;

		// Both edit the same field while offline. Device A's write is the newer
		// one, and device B, holding the older one, is the last to sync: its edit
		// must lose the push and must not be pushed back over A's afterwards.
		await deviceA.repos.localNoteFieldValueRepository.update(fieldValueId, {
			value: "A's answer",
		});
		await deviceB.repos.localNoteFieldValueRepository.update(fieldValueId, {
			value: "B's answer",
		});
		await deviceA.setUpdatedAt(
			"noteFieldValues",
			fieldValueId,
			laterThanSetup(2000),
		);
		await deviceB.setUpdatedAt(
			"noteFieldValues",
			fieldValueId,
			laterThanSetup(1000),
		);

		await syncUntilConverged(deviceA, deviceB);

		const onA =
			await deviceA.repos.localNoteFieldValueRepository.findById(fieldValueId);
		const onB =
			await deviceB.repos.localNoteFieldValueRepository.findById(fieldValueId);
		const onServer = server.getNoteFieldValue(fieldValueId);

		expect(onA?.value).toBe("A's answer");
		expect(onB?.value).toBe("A's answer");
		expect(onServer?.value).toBe("A's answer");
	});

	it("merges an offline device's new deck with a deck created online elsewhere", async () => {
		const { noteType } = await seedNoteType(deviceA, server.userId);
		await deviceA.sync();
		await deviceB.sync();

		// Device B is online and creates its own deck
		const onlineDeck = await deviceB.repos.localDeckRepository.create({
			userId: server.userId,
			name: "Created online on B",
			description: null,
			defaultNoteTypeId: noteType.id,
		});
		await deviceB.sync();

		// Device A is offline: a new deck plus five notes pile up locally
		const offlineDeck = await deviceA.repos.localDeckRepository.create({
			userId: server.userId,
			name: "Created offline on A",
			description: null,
			defaultNoteTypeId: noteType.id,
		});
		for (let i = 1; i <= 5; i++) {
			await deviceA.repos.localNoteRepository.createWithCards({
				deckId: offlineDeck.id,
				noteTypeId: noteType.id,
				fields: { Front: `front ${i}`, Back: `back ${i}` },
			});
		}

		// Device A comes back online
		await syncUntilConverged(deviceA, deviceB);

		for (const device of [deviceA, deviceB]) {
			const decks = await device.repos.localDeckRepository.findByUserId(
				server.userId,
			);
			expect(decks.map((deck) => deck.name).sort()).toEqual([
				"Created offline on A",
				"Created online on B",
			]);

			const notes = await device.repos.localNoteRepository.findByDeckId(
				offlineDeck.id,
			);
			expect(notes).toHaveLength(5);

			const onlineDeckRow = await device.repos.localDeckRepository.findById(
				onlineDeck.id,
			);
			expect(onlineDeckRow?.name).toBe("Created online on B");
		}
	});

	it("agrees on the tombstone when both devices delete the same deck", async () => {
		const deck = await deviceA.repos.localDeckRepository.create({
			userId: server.userId,
			name: "Doomed",
			description: null,
			defaultNoteTypeId: null,
		});
		await deviceA.sync();
		await deviceB.sync();

		// Both devices delete it while offline, device B a day later than A
		await deviceA.repos.localDeckRepository.delete(deck.id);
		await deviceB.repos.localDeckRepository.delete(deck.id);
		await deviceA.setUpdatedAt("decks", deck.id, laterThanSetup(1000));
		await deviceB.setUpdatedAt("decks", deck.id, laterThanSetup(2000));

		await syncUntilConverged(deviceA, deviceB);

		const onA = await deviceA.repos.localDeckRepository.findById(deck.id);
		const onB = await deviceB.repos.localDeckRepository.findById(deck.id);
		const onServer = server.getDeck(deck.id);

		expect(onA?.deletedAt).not.toBeNull();
		expect(onB?.deletedAt).not.toBeNull();
		expect(onA?.deletedAt?.getTime()).toBe(onB?.deletedAt?.getTime());
		expect(onA?.deletedAt?.getTime()).toBe(onServer?.deletedAt?.getTime());

		// And the deck is gone from both devices' deck lists
		for (const device of [deviceA, deviceB]) {
			const decks = await device.repos.localDeckRepository.findByUserId(
				server.userId,
			);
			expect(decks.map((row) => row.id)).not.toContain(deck.id);
		}
	});
});
