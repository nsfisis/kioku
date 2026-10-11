/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db, type LocalNoteFieldValue } from "../db/index";
import { localNoteFieldValueRepository } from "../db/repositories";
import { ConflictResolver } from "./conflict";
import { crdtSyncDb } from "./crdt";
import { SyncManager } from "./manager";
import { PullService, type SyncPullResult } from "./pull";
import {
	PushService,
	pendingChangesToPushData,
	type SyncPushData,
	type SyncPushResult,
} from "./push";
import { SyncQueue } from "./queue";

/**
 * In-memory stand-in for the note field value part of
 * `src/server/repositories/sync.ts`: LWW on `updatedAt` for rows, the CRDT
 * document overwritten by whatever was pushed last, and every write numbered
 * from one global sequence.
 */
function createFakeServer() {
	let seq = 0;
	const rows = new Map<
		string,
		{ data: SyncPushData["noteFieldValues"][number]; syncVersion: number }
	>();
	const crdtDocuments = new Map<
		string,
		{ payload: SyncPushData["crdtChanges"][number]; syncVersion: number }
	>();

	return {
		getValue(id: string): string | undefined {
			return rows.get(id)?.data.value;
		},

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

			for (const fieldValue of data.noteFieldValues) {
				const existing = rows.get(fieldValue.id);
				if (
					!existing ||
					new Date(fieldValue.updatedAt) > new Date(existing.data.updatedAt)
				) {
					const syncVersion = ++seq;
					rows.set(fieldValue.id, { data: fieldValue, syncVersion });
					result.noteFieldValues.push({ id: fieldValue.id, syncVersion });
				} else {
					result.conflicts.noteFieldValues.push(fieldValue.id);
					result.noteFieldValues.push({
						id: fieldValue.id,
						syncVersion: existing.syncVersion,
					});
				}
			}

			for (const payload of data.crdtChanges) {
				crdtDocuments.set(payload.documentId, {
					payload,
					syncVersion: ++seq,
				});
			}

			return result;
		},

		async pull(lastSyncVersion: number): Promise<SyncPullResult> {
			const noteFieldValues = [...rows.values()]
				.filter((row) => row.syncVersion > lastSyncVersion)
				.map((row) => ({
					...row.data,
					createdAt: new Date(row.data.createdAt),
					updatedAt: new Date(row.data.updatedAt),
					syncVersion: row.syncVersion,
				}));
			const pulledDocuments = [...crdtDocuments.values()].filter(
				(doc) => doc.syncVersion > lastSyncVersion,
			);

			return {
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues,
				crdtChanges: pulledDocuments.map((doc) => doc.payload),
				currentSyncVersion: Math.max(
					lastSyncVersion,
					...noteFieldValues.map((row) => row.syncVersion),
					...pulledDocuments.map((doc) => doc.syncVersion),
				),
			};
		},
	};
}

type FakeServer = ReturnType<typeof createFakeServer>;

/** Push an edit the way another device would. */
function pushFromOtherDevice(
	server: FakeServer,
	fieldValue: LocalNoteFieldValue,
): Promise<SyncPushResult> {
	return server.push(
		pendingChangesToPushData({
			decks: [],
			cards: [],
			reviewLogs: [],
			noteTypes: [],
			noteFieldTypes: [],
			notes: [],
			noteFieldValues: [fieldValue],
		}),
	);
}

function createDevice(server: FakeServer): SyncManager {
	const syncQueue = new SyncQueue();
	return new SyncManager({
		syncQueue,
		pushService: new PushService({ syncQueue, pushToServer: server.push }),
		pullService: new PullService({ syncQueue, pullFromServer: server.pull }),
		conflictResolver: new ConflictResolver(),
	});
}

describe("two devices editing the same note field value", () => {
	const minutesAgo = (minutes: number) =>
		new Date(Date.now() - minutes * 60_000);

	const original: LocalNoteFieldValue = {
		id: "00000000-0000-4000-8000-000000000001",
		noteId: "note-1",
		noteFieldTypeId: "field-type-1",
		value: "original",
		createdAt: minutesAgo(10),
		updatedAt: minutesAgo(10),
		syncVersion: 0,
		_synced: false,
	};

	beforeEach(async () => {
		await db.noteFieldValues.clear();
		await crdtSyncDb.syncState.clear();
		await crdtSyncDb.metadata.clear();
		localStorage.clear();
	});

	it("keeps the newer edit when the device with the older edit syncs last", async () => {
		const server = createFakeServer();
		const deviceA = createDevice(server);

		await db.noteFieldValues.put(original);
		await deviceA.sync();

		// Device A edits while offline.
		await db.noteFieldValues.put({
			...original,
			value: "older edit from A",
			updatedAt: minutesAgo(5),
			_synced: false,
		});

		// Device B edits later and syncs first.
		await pushFromOtherDevice(server, {
			...original,
			value: "newer edit from B",
			updatedAt: minutesAgo(1),
		});

		// Device A comes back online. Its older edit must neither survive locally
		// nor be pushed over B's on a later sync.
		await deviceA.sync();
		await deviceA.sync();

		const local = await localNoteFieldValueRepository.findById(original.id);
		expect(local?.value).toBe("newer edit from B");
		expect(local?._synced).toBe(true);
		expect(server.getValue(original.id)).toBe("newer edit from B");
	});

	it("keeps this device's edit when it is the newer one", async () => {
		const server = createFakeServer();
		const deviceA = createDevice(server);

		await db.noteFieldValues.put(original);
		await deviceA.sync();

		await pushFromOtherDevice(server, {
			...original,
			value: "older edit from B",
			updatedAt: minutesAgo(5),
		});

		await db.noteFieldValues.put({
			...original,
			value: "newer edit from A",
			updatedAt: minutesAgo(1),
			_synced: false,
		});

		await deviceA.sync();
		await deviceA.sync();

		const local = await localNoteFieldValueRepository.findById(original.id);
		expect(local?.value).toBe("newer edit from A");
		expect(server.getValue(original.id)).toBe("newer edit from A");
	});
});
