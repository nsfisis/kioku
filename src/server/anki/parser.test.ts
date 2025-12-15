import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { deflateRawSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	type AnkiPackage,
	listAnkiPackageContents,
	parseAnkiPackage,
} from "./parser.js";

/**
 * Create a minimal ZIP file with the given entries
 */
function createZip(entries: Map<string, Buffer>): Buffer {
	const chunks: Buffer[] = [];
	const centralDirectory: Buffer[] = [];
	let offset = 0;

	for (const [name, data] of entries) {
		const nameBuffer = Buffer.from(name, "utf8");
		const compressedData = deflateRawSync(data);

		// Local file header
		const localHeader = Buffer.alloc(30 + nameBuffer.length);
		localHeader.writeUInt32LE(0x04034b50, 0); // signature
		localHeader.writeUInt16LE(20, 4); // version needed
		localHeader.writeUInt16LE(0, 6); // flags
		localHeader.writeUInt16LE(8, 8); // compression method (deflate)
		localHeader.writeUInt16LE(0, 10); // mod time
		localHeader.writeUInt16LE(0, 12); // mod date
		localHeader.writeUInt32LE(0, 14); // crc32 (not validated in our parser)
		localHeader.writeUInt32LE(compressedData.length, 18); // compressed size
		localHeader.writeUInt32LE(data.length, 22); // uncompressed size
		localHeader.writeUInt16LE(nameBuffer.length, 26); // file name length
		localHeader.writeUInt16LE(0, 28); // extra field length
		nameBuffer.copy(localHeader, 30);

		// Central directory entry
		const centralEntry = Buffer.alloc(46 + nameBuffer.length);
		centralEntry.writeUInt32LE(0x02014b50, 0); // signature
		centralEntry.writeUInt16LE(20, 4); // version made by
		centralEntry.writeUInt16LE(20, 6); // version needed
		centralEntry.writeUInt16LE(0, 8); // flags
		centralEntry.writeUInt16LE(8, 10); // compression method
		centralEntry.writeUInt16LE(0, 12); // mod time
		centralEntry.writeUInt16LE(0, 14); // mod date
		centralEntry.writeUInt32LE(0, 16); // crc32
		centralEntry.writeUInt32LE(compressedData.length, 20); // compressed size
		centralEntry.writeUInt32LE(data.length, 24); // uncompressed size
		centralEntry.writeUInt16LE(nameBuffer.length, 28); // file name length
		centralEntry.writeUInt16LE(0, 30); // extra field length
		centralEntry.writeUInt16LE(0, 32); // comment length
		centralEntry.writeUInt16LE(0, 34); // disk number
		centralEntry.writeUInt16LE(0, 36); // internal attributes
		centralEntry.writeUInt32LE(0, 38); // external attributes
		centralEntry.writeUInt32LE(offset, 42); // offset of local header
		nameBuffer.copy(centralEntry, 46);

		centralDirectory.push(centralEntry);
		chunks.push(localHeader, compressedData);
		offset += localHeader.length + compressedData.length;
	}

	// Central directory
	const centralDirOffset = offset;
	const centralDirBuffer = Buffer.concat(centralDirectory);
	chunks.push(centralDirBuffer);

	// End of central directory
	const endRecord = Buffer.alloc(22);
	endRecord.writeUInt32LE(0x06054b50, 0); // signature
	endRecord.writeUInt16LE(0, 4); // disk number
	endRecord.writeUInt16LE(0, 6); // disk with central dir
	endRecord.writeUInt16LE(entries.size, 8); // entries on this disk
	endRecord.writeUInt16LE(entries.size, 10); // total entries
	endRecord.writeUInt32LE(centralDirBuffer.length, 12); // central dir size
	endRecord.writeUInt32LE(centralDirOffset, 16); // central dir offset
	endRecord.writeUInt16LE(0, 20); // comment length
	chunks.push(endRecord);

	return Buffer.concat(chunks);
}

/**
 * Create a test Anki SQLite database
 */
function createTestAnkiDb(dbPath: string): void {
	const db = new DatabaseSync(dbPath);

	// Create tables
	db.exec(`
		CREATE TABLE col (
			id INTEGER PRIMARY KEY,
			crt INTEGER NOT NULL,
			mod INTEGER NOT NULL,
			scm INTEGER NOT NULL,
			ver INTEGER NOT NULL,
			dty INTEGER NOT NULL,
			usn INTEGER NOT NULL,
			ls INTEGER NOT NULL,
			conf TEXT NOT NULL,
			models TEXT NOT NULL,
			decks TEXT NOT NULL,
			dconf TEXT NOT NULL,
			tags TEXT NOT NULL
		)
	`);

	db.exec(`
		CREATE TABLE notes (
			id INTEGER PRIMARY KEY,
			guid TEXT NOT NULL,
			mid INTEGER NOT NULL,
			mod INTEGER NOT NULL,
			usn INTEGER NOT NULL,
			tags TEXT NOT NULL,
			flds TEXT NOT NULL,
			sfld TEXT NOT NULL,
			csum INTEGER NOT NULL,
			flags INTEGER NOT NULL,
			data TEXT NOT NULL
		)
	`);

	db.exec(`
		CREATE TABLE cards (
			id INTEGER PRIMARY KEY,
			nid INTEGER NOT NULL,
			did INTEGER NOT NULL,
			ord INTEGER NOT NULL,
			mod INTEGER NOT NULL,
			usn INTEGER NOT NULL,
			type INTEGER NOT NULL,
			queue INTEGER NOT NULL,
			due INTEGER NOT NULL,
			ivl INTEGER NOT NULL,
			factor INTEGER NOT NULL,
			reps INTEGER NOT NULL,
			lapses INTEGER NOT NULL,
			left INTEGER NOT NULL,
			odue INTEGER NOT NULL,
			odid INTEGER NOT NULL,
			flags INTEGER NOT NULL,
			data TEXT NOT NULL
		)
	`);

	// Insert collection data
	const decks = {
		"1": { id: 1, name: "Default", desc: "" },
		"1234567890123": {
			id: 1234567890123,
			name: "Test Deck",
			desc: "A test deck",
		},
	};

	const models = {
		"9876543210987": {
			id: 9876543210987,
			name: "Basic",
			flds: [{ name: "Front" }, { name: "Back" }],
			tmpls: [{ name: "Card 1", qfmt: "{{Front}}", afmt: "{{Back}}" }],
		},
	};

	const insertCol = db.prepare(`
		INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`);
	insertCol.run(
		1,
		1600000000,
		1600000001000,
		1600000000000,
		11,
		0,
		-1,
		0,
		"{}",
		JSON.stringify(models),
		JSON.stringify(decks),
		"{}",
		"{}",
	);

	// Insert test notes
	const insertNote = db.prepare(`
		INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`);

	// Note 1: Simple card
	insertNote.run(
		1000000000001,
		"abc123",
		9876543210987,
		1600000001,
		-1,
		" vocabulary test ",
		"Hello\x1fWorld",
		"Hello",
		12345,
		0,
		"",
	);

	// Note 2: Card with multiple tags
	insertNote.run(
		1000000000002,
		"def456",
		9876543210987,
		1600000002,
		-1,
		" japanese kanji n5 ",
		"日本語\x1fJapanese",
		"日本語",
		67890,
		0,
		"",
	);

	// Note 3: Card with no tags
	insertNote.run(
		1000000000003,
		"ghi789",
		9876543210987,
		1600000003,
		-1,
		"",
		"Question\x1fAnswer",
		"Question",
		11111,
		0,
		"",
	);

	// Insert test cards
	const insertCard = db.prepare(`
		INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`);

	// Card for note 1 (new card)
	insertCard.run(
		2000000000001,
		1000000000001,
		1234567890123,
		0,
		1600000001,
		-1,
		0,
		0,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		"",
	);

	// Card for note 2 (review card)
	insertCard.run(
		2000000000002,
		1000000000002,
		1234567890123,
		0,
		1600000002,
		-1,
		2,
		2,
		100,
		30,
		2500,
		5,
		1,
		0,
		0,
		0,
		0,
		"",
	);

	// Card for note 3 (learning card)
	insertCard.run(
		2000000000003,
		1000000000003,
		1234567890123,
		0,
		1600000003,
		-1,
		1,
		1,
		1600100000,
		1,
		2500,
		1,
		0,
		1001,
		0,
		0,
		0,
		"",
	);

	db.close();
}

describe("Anki Parser", () => {
	let tempDir: string;
	let testApkgPath: string;

	beforeAll(async () => {
		// Create temp directory
		tempDir = join(tmpdir(), `kioku-test-${randomBytes(8).toString("hex")}`);
		await mkdir(tempDir, { recursive: true });

		// Create test database
		const dbPath = join(tempDir, "collection.anki2");
		createTestAnkiDb(dbPath);

		// Read the database file
		const { readFile } = await import("node:fs/promises");
		const dbBuffer = await readFile(dbPath);

		// Create media file (empty JSON object)
		const mediaBuffer = Buffer.from("{}", "utf8");

		// Create ZIP with database and media
		const zipEntries = new Map<string, Buffer>();
		zipEntries.set("collection.anki2", dbBuffer);
		zipEntries.set("media", mediaBuffer);

		const zipBuffer = createZip(zipEntries);

		// Write the .apkg file
		testApkgPath = join(tempDir, "test.apkg");
		await writeFile(testApkgPath, zipBuffer);
	});

	afterAll(async () => {
		// Clean up
		await rm(tempDir, { recursive: true, force: true });
	});

	describe("listAnkiPackageContents", () => {
		it("should list files in the package", async () => {
			const files = await listAnkiPackageContents(testApkgPath);

			expect(files).toContain("collection.anki2");
			expect(files).toContain("media");
		});
	});

	describe("parseAnkiPackage", () => {
		let result: AnkiPackage;

		beforeAll(async () => {
			result = await parseAnkiPackage(testApkgPath);
		});

		it("should parse decks correctly", () => {
			expect(result.decks.length).toBe(2);

			const testDeck = result.decks.find((d) => d.name === "Test Deck");
			expect(testDeck).toBeDefined();
			expect(testDeck?.description).toBe("A test deck");

			const defaultDeck = result.decks.find((d) => d.name === "Default");
			expect(defaultDeck).toBeDefined();
		});

		it("should parse models correctly", () => {
			expect(result.models.length).toBe(1);

			const basicModel = result.models[0];
			expect(basicModel).toBeDefined();
			expect(basicModel?.name).toBe("Basic");
			expect(basicModel?.fields).toEqual(["Front", "Back"]);
			expect(basicModel?.templates.length).toBe(1);
			expect(basicModel?.templates[0]?.name).toBe("Card 1");
			expect(basicModel?.templates[0]?.qfmt).toBe("{{Front}}");
			expect(basicModel?.templates[0]?.afmt).toBe("{{Back}}");
		});

		it("should parse notes correctly", () => {
			expect(result.notes.length).toBe(3);

			// Note 1
			const note1 = result.notes.find((n) => n.guid === "abc123");
			expect(note1).toBeDefined();
			expect(note1?.fields).toEqual(["Hello", "World"]);
			expect(note1?.tags).toEqual(["vocabulary", "test"]);
			expect(note1?.sfld).toBe("Hello");

			// Note 2
			const note2 = result.notes.find((n) => n.guid === "def456");
			expect(note2).toBeDefined();
			expect(note2?.fields).toEqual(["日本語", "Japanese"]);
			expect(note2?.tags).toEqual(["japanese", "kanji", "n5"]);

			// Note 3 (no tags)
			const note3 = result.notes.find((n) => n.guid === "ghi789");
			expect(note3).toBeDefined();
			expect(note3?.tags).toEqual([]);
		});

		it("should parse cards correctly", () => {
			expect(result.cards.length).toBe(3);

			// New card
			const card1 = result.cards.find((c) => c.nid === 1000000000001);
			expect(card1).toBeDefined();
			expect(card1?.type).toBe(0); // new
			expect(card1?.reps).toBe(0);

			// Review card
			const card2 = result.cards.find((c) => c.nid === 1000000000002);
			expect(card2).toBeDefined();
			expect(card2?.type).toBe(2); // review
			expect(card2?.ivl).toBe(30);
			expect(card2?.reps).toBe(5);
			expect(card2?.lapses).toBe(1);

			// Learning card
			const card3 = result.cards.find((c) => c.nid === 1000000000003);
			expect(card3).toBeDefined();
			expect(card3?.type).toBe(1); // learning
		});

		it("should throw error for non-existent file", async () => {
			await expect(parseAnkiPackage("/non/existent/file.apkg")).rejects.toThrow(
				"File not found",
			);
		});

		it("should throw error for invalid package without database", async () => {
			// Create a ZIP without a database
			const zipEntries = new Map<string, Buffer>();
			zipEntries.set("media", Buffer.from("{}", "utf8"));
			const invalidZip = createZip(zipEntries);

			const invalidPath = join(tempDir, "invalid.apkg");
			await writeFile(invalidPath, invalidZip);

			await expect(parseAnkiPackage(invalidPath)).rejects.toThrow(
				"No Anki database found",
			);
		});
	});

	describe("ZIP extraction", () => {
		it("should handle uncompressed entries", async () => {
			// Create a ZIP with uncompressed entries
			const name = Buffer.from("test.txt", "utf8");
			const data = Buffer.from("Hello, World!", "utf8");

			// Local file header (uncompressed)
			const localHeader = Buffer.alloc(30 + name.length);
			localHeader.writeUInt32LE(0x04034b50, 0);
			localHeader.writeUInt16LE(20, 4);
			localHeader.writeUInt16LE(0, 6);
			localHeader.writeUInt16LE(0, 8); // no compression
			localHeader.writeUInt16LE(0, 10);
			localHeader.writeUInt16LE(0, 12);
			localHeader.writeUInt32LE(0, 14);
			localHeader.writeUInt32LE(data.length, 18);
			localHeader.writeUInt32LE(data.length, 22);
			localHeader.writeUInt16LE(name.length, 26);
			localHeader.writeUInt16LE(0, 28);
			name.copy(localHeader, 30);

			// Central directory
			const centralEntry = Buffer.alloc(46 + name.length);
			centralEntry.writeUInt32LE(0x02014b50, 0);
			centralEntry.writeUInt16LE(20, 4);
			centralEntry.writeUInt16LE(20, 6);
			centralEntry.writeUInt16LE(0, 8);
			centralEntry.writeUInt16LE(0, 10);
			centralEntry.writeUInt16LE(0, 12);
			centralEntry.writeUInt16LE(0, 14);
			centralEntry.writeUInt32LE(0, 16);
			centralEntry.writeUInt32LE(data.length, 20);
			centralEntry.writeUInt32LE(data.length, 24);
			centralEntry.writeUInt16LE(name.length, 28);
			centralEntry.writeUInt16LE(0, 30);
			centralEntry.writeUInt16LE(0, 32);
			centralEntry.writeUInt16LE(0, 34);
			centralEntry.writeUInt16LE(0, 36);
			centralEntry.writeUInt32LE(0, 38);
			centralEntry.writeUInt32LE(0, 42);
			name.copy(centralEntry, 46);

			// End of central directory
			const endRecord = Buffer.alloc(22);
			endRecord.writeUInt32LE(0x06054b50, 0);
			endRecord.writeUInt16LE(0, 4);
			endRecord.writeUInt16LE(0, 6);
			endRecord.writeUInt16LE(1, 8);
			endRecord.writeUInt16LE(1, 10);
			endRecord.writeUInt32LE(centralEntry.length, 12);
			endRecord.writeUInt32LE(localHeader.length + data.length, 16);
			endRecord.writeUInt16LE(0, 20);

			const zipBuffer = Buffer.concat([
				localHeader,
				data,
				centralEntry,
				endRecord,
			]);

			const testPath = join(tempDir, "uncompressed.zip");
			await writeFile(testPath, zipBuffer);

			const files = await listAnkiPackageContents(testPath);
			expect(files).toContain("test.txt");
		});
	});
});
