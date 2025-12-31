import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
	base64ToBinary,
	binaryToBase64,
	type CrdtSyncPayload,
	type CrdtSyncStateEntry,
	CrdtSyncStateManager,
	crdtSyncDb,
	entriesToSyncPayload,
	syncPayloadToEntries,
} from "./sync-state";
import { CrdtEntityType } from "./types";

describe("binaryToBase64 and base64ToBinary", () => {
	it("should roundtrip binary data correctly", () => {
		const original = new Uint8Array([0, 1, 2, 255, 128, 64]);
		const base64 = binaryToBase64(original);
		const restored = base64ToBinary(base64);

		expect(restored).toEqual(original);
	});

	it("should handle empty array", () => {
		const original = new Uint8Array([]);
		const base64 = binaryToBase64(original);
		const restored = base64ToBinary(base64);

		expect(restored).toEqual(original);
	});

	it("should handle large data", () => {
		const original = new Uint8Array(1000);
		for (let i = 0; i < 1000; i++) {
			original[i] = i % 256;
		}

		const base64 = binaryToBase64(original);
		const restored = base64ToBinary(base64);

		expect(restored).toEqual(original);
	});

	it("should produce valid base64 string", () => {
		const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
		const base64 = binaryToBase64(data);

		expect(base64).toBe("SGVsbG8=");
	});
});

describe("entriesToSyncPayload", () => {
	it("should convert entries to sync payload format", () => {
		const entries: CrdtSyncStateEntry[] = [
			{
				documentId: "deck:deck-1",
				entityType: CrdtEntityType.Deck,
				entityId: "deck-1",
				binary: new Uint8Array([1, 2, 3]),
				lastSyncedAt: Date.now(),
				syncVersion: 1,
			},
			{
				documentId: "card:card-1",
				entityType: CrdtEntityType.Card,
				entityId: "card-1",
				binary: new Uint8Array([4, 5, 6]),
				lastSyncedAt: Date.now(),
				syncVersion: 2,
			},
		];

		const payloads = entriesToSyncPayload(entries);

		expect(payloads).toHaveLength(2);
		expect(payloads[0]?.documentId).toBe("deck:deck-1");
		expect(payloads[0]?.entityType).toBe(CrdtEntityType.Deck);
		expect(payloads[0]?.entityId).toBe("deck-1");
		expect(typeof payloads[0]?.binary).toBe("string"); // Base64 encoded
	});
});

describe("syncPayloadToEntries", () => {
	it("should convert sync payload to entries format", () => {
		const payloads: CrdtSyncPayload[] = [
			{
				documentId: "deck:deck-1",
				entityType: CrdtEntityType.Deck,
				entityId: "deck-1",
				binary: binaryToBase64(new Uint8Array([1, 2, 3])),
			},
		];

		const entries = syncPayloadToEntries(payloads, 5);

		expect(entries).toHaveLength(1);
		expect(entries[0]?.entityType).toBe(CrdtEntityType.Deck);
		expect(entries[0]?.entityId).toBe("deck-1");
		expect(entries[0]?.binary).toEqual(new Uint8Array([1, 2, 3]));
		expect(entries[0]?.syncVersion).toBe(5);
	});
});

describe("CrdtSyncStateManager", () => {
	let manager: CrdtSyncStateManager;

	beforeEach(async () => {
		manager = new CrdtSyncStateManager();
		await crdtSyncDb.syncState.clear();
		await crdtSyncDb.metadata.clear();
	});

	afterEach(async () => {
		await crdtSyncDb.syncState.clear();
		await crdtSyncDb.metadata.clear();
	});

	describe("document operations", () => {
		it("should store and retrieve document binary", async () => {
			const binary = new Uint8Array([1, 2, 3, 4, 5]);
			await manager.setDocumentBinary(CrdtEntityType.Deck, "deck-1", binary, 1);

			const retrieved = await manager.getDocumentBinary(
				CrdtEntityType.Deck,
				"deck-1",
			);
			expect(retrieved).toEqual(binary);
		});

		it("should return null for non-existent document", async () => {
			const result = await manager.getDocumentBinary(
				CrdtEntityType.Deck,
				"non-existent",
			);
			expect(result).toBeNull();
		});

		it("should update existing document", async () => {
			await manager.setDocumentBinary(
				CrdtEntityType.Deck,
				"deck-1",
				new Uint8Array([1]),
				1,
			);
			await manager.setDocumentBinary(
				CrdtEntityType.Deck,
				"deck-1",
				new Uint8Array([2]),
				2,
			);

			const retrieved = await manager.getDocumentBinary(
				CrdtEntityType.Deck,
				"deck-1",
			);
			expect(retrieved).toEqual(new Uint8Array([2]));
		});

		it("should delete document", async () => {
			await manager.setDocumentBinary(
				CrdtEntityType.Deck,
				"deck-1",
				new Uint8Array([1]),
				1,
			);
			await manager.deleteDocument(CrdtEntityType.Deck, "deck-1");

			const result = await manager.getDocumentBinary(
				CrdtEntityType.Deck,
				"deck-1",
			);
			expect(result).toBeNull();
		});

		it("should check if document exists", async () => {
			expect(await manager.hasDocument(CrdtEntityType.Deck, "deck-1")).toBe(
				false,
			);

			await manager.setDocumentBinary(
				CrdtEntityType.Deck,
				"deck-1",
				new Uint8Array([1]),
				1,
			);

			expect(await manager.hasDocument(CrdtEntityType.Deck, "deck-1")).toBe(
				true,
			);
		});
	});

	describe("document by type operations", () => {
		it("should get all documents by type", async () => {
			await manager.setDocumentBinary(
				CrdtEntityType.Deck,
				"deck-1",
				new Uint8Array([1]),
				1,
			);
			await manager.setDocumentBinary(
				CrdtEntityType.Deck,
				"deck-2",
				new Uint8Array([2]),
				1,
			);
			await manager.setDocumentBinary(
				CrdtEntityType.Card,
				"card-1",
				new Uint8Array([3]),
				1,
			);

			const decks = await manager.getDocumentsByType(CrdtEntityType.Deck);
			expect(decks).toHaveLength(2);

			const cards = await manager.getDocumentsByType(CrdtEntityType.Card);
			expect(cards).toHaveLength(1);
		});

		it("should delete documents by type", async () => {
			await manager.setDocumentBinary(
				CrdtEntityType.Deck,
				"deck-1",
				new Uint8Array([1]),
				1,
			);
			await manager.setDocumentBinary(
				CrdtEntityType.Deck,
				"deck-2",
				new Uint8Array([2]),
				1,
			);
			await manager.setDocumentBinary(
				CrdtEntityType.Card,
				"card-1",
				new Uint8Array([3]),
				1,
			);

			await manager.deleteDocumentsByType(CrdtEntityType.Deck);

			const decks = await manager.getDocumentsByType(CrdtEntityType.Deck);
			expect(decks).toHaveLength(0);

			const cards = await manager.getDocumentsByType(CrdtEntityType.Card);
			expect(cards).toHaveLength(1);
		});

		it("should count documents by type", async () => {
			await manager.setDocumentBinary(
				CrdtEntityType.Deck,
				"deck-1",
				new Uint8Array([1]),
				1,
			);
			await manager.setDocumentBinary(
				CrdtEntityType.Deck,
				"deck-2",
				new Uint8Array([2]),
				1,
			);

			const count = await manager.getDocumentCountByType(CrdtEntityType.Deck);
			expect(count).toBe(2);
		});
	});

	describe("metadata operations", () => {
		it("should get and set metadata", async () => {
			await manager.setMetadata({
				lastSyncAt: 1234567890,
				syncVersionWatermark: 10,
				actorId: "actor-123",
			});

			const metadata = await manager.getMetadata();
			expect(metadata?.lastSyncAt).toBe(1234567890);
			expect(metadata?.syncVersionWatermark).toBe(10);
			expect(metadata?.actorId).toBe("actor-123");
		});

		it("should return null for non-existent metadata", async () => {
			const metadata = await manager.getMetadata();
			expect(metadata).toBeNull();
		});

		it("should update partial metadata", async () => {
			await manager.setMetadata({
				lastSyncAt: 1000,
				syncVersionWatermark: 1,
				actorId: "actor-1",
			});

			await manager.setMetadata({ lastSyncAt: 2000 });

			const metadata = await manager.getMetadata();
			expect(metadata?.lastSyncAt).toBe(2000);
			expect(metadata?.syncVersionWatermark).toBe(1); // Preserved
			expect(metadata?.actorId).toBe("actor-1"); // Preserved
		});

		it("should get and set last sync timestamp", async () => {
			expect(await manager.getLastSyncAt()).toBe(0);

			await manager.setLastSyncAt(1234567890);
			expect(await manager.getLastSyncAt()).toBe(1234567890);
		});

		it("should get and set sync version watermark", async () => {
			expect(await manager.getSyncVersionWatermark()).toBe(0);

			await manager.setSyncVersionWatermark(42);
			expect(await manager.getSyncVersionWatermark()).toBe(42);
		});
	});

	describe("batch operations", () => {
		it("should batch set multiple documents", async () => {
			const deckType = CrdtEntityType.Deck;
			const cardType = CrdtEntityType.Card;
			const entries = [
				{
					entityType: deckType,
					entityId: "deck-1",
					binary: new Uint8Array([1]),
					syncVersion: 1,
				},
				{
					entityType: cardType,
					entityId: "card-1",
					binary: new Uint8Array([2]),
					syncVersion: 1,
				},
				{
					entityType: cardType,
					entityId: "card-2",
					binary: new Uint8Array([3]),
					syncVersion: 1,
				},
			];

			await manager.batchSetDocuments(entries);

			expect(await manager.getTotalDocumentCount()).toBe(3);
			expect(
				await manager.getDocumentBinary(CrdtEntityType.Deck, "deck-1"),
			).toEqual(new Uint8Array([1]));
			expect(
				await manager.getDocumentBinary(CrdtEntityType.Card, "card-1"),
			).toEqual(new Uint8Array([2]));
		});

		it("should batch delete multiple documents", async () => {
			await manager.setDocumentBinary(
				CrdtEntityType.Deck,
				"deck-1",
				new Uint8Array([1]),
				1,
			);
			await manager.setDocumentBinary(
				CrdtEntityType.Card,
				"card-1",
				new Uint8Array([2]),
				1,
			);
			await manager.setDocumentBinary(
				CrdtEntityType.Card,
				"card-2",
				new Uint8Array([3]),
				1,
			);

			await manager.batchDeleteDocuments([
				{ entityType: CrdtEntityType.Deck, entityId: "deck-1" },
				{ entityType: CrdtEntityType.Card, entityId: "card-1" },
			]);

			expect(await manager.getTotalDocumentCount()).toBe(1);
			expect(
				await manager.getDocumentBinary(CrdtEntityType.Card, "card-2"),
			).toEqual(new Uint8Array([3]));
		});
	});

	describe("sync time queries", () => {
		it("should get documents synced since timestamp", async () => {
			// Set documents with different sync times
			await manager.setDocumentBinary(
				CrdtEntityType.Deck,
				"deck-1",
				new Uint8Array([1]),
				1,
			);

			// Wait a bit to ensure different timestamps
			await new Promise((resolve) => setTimeout(resolve, 10));
			const afterFirst = Date.now();

			await manager.setDocumentBinary(
				CrdtEntityType.Deck,
				"deck-2",
				new Uint8Array([2]),
				1,
			);

			const recentDocs = await manager.getDocumentsSyncedSince(afterFirst - 5);
			expect(recentDocs.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("clear operations", () => {
		it("should clear all data", async () => {
			await manager.setDocumentBinary(
				CrdtEntityType.Deck,
				"deck-1",
				new Uint8Array([1]),
				1,
			);
			await manager.setMetadata({ lastSyncAt: 1000 });

			await manager.clearAll();

			expect(await manager.getTotalDocumentCount()).toBe(0);
			expect(await manager.getMetadata()).toBeNull();
		});
	});

	describe("total document count", () => {
		it("should return total count of all documents", async () => {
			expect(await manager.getTotalDocumentCount()).toBe(0);

			await manager.setDocumentBinary(
				CrdtEntityType.Deck,
				"deck-1",
				new Uint8Array([1]),
				1,
			);
			await manager.setDocumentBinary(
				CrdtEntityType.Card,
				"card-1",
				new Uint8Array([2]),
				1,
			);

			expect(await manager.getTotalDocumentCount()).toBe(2);
		});
	});
});
