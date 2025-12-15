import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createInflateRaw } from "node:zlib";

/**
 * Represents a note from an Anki database
 */
export interface AnkiNote {
	id: number;
	guid: string;
	mid: number; // model/notetype id
	mod: number;
	tags: string[];
	fields: string[]; // fields separated by 0x1f in the database
	sfld: string; // sort field
}

/**
 * Represents a card from an Anki database
 */
export interface AnkiCard {
	id: number;
	nid: number; // note id
	did: number; // deck id
	ord: number; // ordinal (which template/cloze)
	mod: number;
	type: number; // 0=new, 1=learning, 2=review, 3=relearning
	queue: number;
	due: number;
	ivl: number; // interval
	factor: number;
	reps: number;
	lapses: number;
}

/**
 * Represents a deck from an Anki database
 */
export interface AnkiDeck {
	id: number;
	name: string;
	description: string;
}

/**
 * Represents a model (note type) from an Anki database
 */
export interface AnkiModel {
	id: number;
	name: string;
	fields: string[];
	templates: {
		name: string;
		qfmt: string; // question format
		afmt: string; // answer format
	}[];
}

/**
 * Represents the parsed contents of an Anki package
 */
export interface AnkiPackage {
	notes: AnkiNote[];
	cards: AnkiCard[];
	decks: AnkiDeck[];
	models: AnkiModel[];
}

// Local file header signature
const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_SIG = 0x02014b50;
const END_CENTRAL_DIR_SIG = 0x06054b50;

/**
 * Parse a ZIP file and extract entries
 * This is a minimal implementation for .apkg files
 */
async function parseZip(filePath: string): Promise<Map<string, Buffer>> {
	const fileHandle = await open(filePath, "r");
	const stat = await fileHandle.stat();
	const fileSize = stat.size;

	try {
		const entries = new Map<string, Buffer>();

		// Read the entire file for simplicity (apkg files are typically small)
		const buffer = Buffer.alloc(fileSize);
		await fileHandle.read(buffer, 0, fileSize, 0);

		let offset = 0;

		while (offset < fileSize) {
			// Read signature
			const sig = buffer.readUInt32LE(offset);

			if (sig === LOCAL_FILE_HEADER_SIG) {
				// Local file header
				const compressionMethod = buffer.readUInt16LE(offset + 8);
				const compressedSize = buffer.readUInt32LE(offset + 18);
				const fileNameLength = buffer.readUInt16LE(offset + 26);
				const extraFieldLength = buffer.readUInt16LE(offset + 28);

				const fileName = buffer
					.subarray(offset + 30, offset + 30 + fileNameLength)
					.toString("utf8");
				const dataOffset = offset + 30 + fileNameLength + extraFieldLength;

				// Extract the data
				const compressedData = buffer.subarray(
					dataOffset,
					dataOffset + compressedSize,
				);

				let data: Buffer;
				if (compressionMethod === 0) {
					// Stored (no compression)
					data = compressedData;
				} else if (compressionMethod === 8) {
					// Deflate
					data = await inflateBuffer(compressedData);
				} else {
					throw new Error(
						`Unsupported compression method: ${compressionMethod}`,
					);
				}

				entries.set(fileName, data);

				offset = dataOffset + compressedSize;
			} else if (sig === CENTRAL_DIR_SIG || sig === END_CENTRAL_DIR_SIG) {
				// We've reached the central directory, stop parsing
				break;
			} else {
				// Unknown signature, try to move forward
				offset++;
			}
		}

		return entries;
	} finally {
		await fileHandle.close();
	}
}

/**
 * Inflate a deflate-compressed buffer
 */
function inflateBuffer(data: Buffer): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		const inflate = createInflateRaw();

		inflate.on("data", (chunk) => chunks.push(chunk));
		inflate.on("end", () => resolve(Buffer.concat(chunks)));
		inflate.on("error", reject);

		inflate.write(data);
		inflate.end();
	});
}

/**
 * Extract and parse an Anki package file (.apkg)
 */
export async function parseAnkiPackage(filePath: string): Promise<AnkiPackage> {
	if (!existsSync(filePath)) {
		throw new Error(`File not found: ${filePath}`);
	}

	// Extract ZIP contents
	const entries = await parseZip(filePath);

	// Find the database file
	let dbBuffer: Buffer | undefined;
	let dbFormat: "anki2" | "anki21" | "anki21b" | undefined;

	// Check for different database formats (newest first)
	if (entries.has("collection.anki21b")) {
		dbBuffer = entries.get("collection.anki21b");
		dbFormat = "anki21b";
	} else if (entries.has("collection.anki21")) {
		dbBuffer = entries.get("collection.anki21");
		dbFormat = "anki21";
	} else if (entries.has("collection.anki2")) {
		dbBuffer = entries.get("collection.anki2");
		dbFormat = "anki2";
	}

	if (!dbBuffer || !dbFormat) {
		const availableFiles = Array.from(entries.keys()).join(", ");
		throw new Error(
			`No Anki database found in package. Available files: ${availableFiles}`,
		);
	}

	// For anki21b format, the database is zstd compressed
	if (dbFormat === "anki21b") {
		throw new Error(
			"anki21b format (zstd compressed) is not yet supported. Please export from Anki using the legacy format.",
		);
	}

	// Write database to temp file (node:sqlite requires a file path)
	const tempDir = join(
		tmpdir(),
		`kioku-anki-${randomBytes(8).toString("hex")}`,
	);
	await mkdir(tempDir, { recursive: true });
	const tempDbPath = join(tempDir, "collection.db");

	try {
		await writeFile(tempDbPath, dbBuffer);

		// Parse the SQLite database
		return parseAnkiDatabase(tempDbPath);
	} finally {
		// Clean up temp files
		await rm(tempDir, { recursive: true, force: true });
	}
}

/**
 * Parse an Anki SQLite database
 */
function parseAnkiDatabase(dbPath: string): AnkiPackage {
	const db = new DatabaseSync(dbPath, { open: true });

	try {
		// Parse notes
		const notes = parseNotes(db);

		// Parse cards
		const cards = parseCards(db);

		// Parse decks and models from the col table
		const { decks, models } = parseCollection(db);

		return { notes, cards, decks, models };
	} finally {
		db.close();
	}
}

/**
 * Parse notes from the database
 */
function parseNotes(db: DatabaseSync): AnkiNote[] {
	const stmt = db.prepare(
		"SELECT id, guid, mid, mod, tags, flds, sfld FROM notes",
	);
	const rows = stmt.all() as Array<{
		id: number;
		guid: string;
		mid: number;
		mod: number;
		tags: string;
		flds: string;
		sfld: string;
	}>;

	return rows.map((row) => ({
		id: row.id,
		guid: row.guid,
		mid: row.mid,
		mod: row.mod,
		tags: row.tags
			.trim()
			.split(/\s+/)
			.filter((t) => t.length > 0),
		fields: row.flds.split("\x1f"),
		sfld: row.sfld,
	}));
}

/**
 * Parse cards from the database
 */
function parseCards(db: DatabaseSync): AnkiCard[] {
	const stmt = db.prepare(
		"SELECT id, nid, did, ord, mod, type, queue, due, ivl, factor, reps, lapses FROM cards",
	);
	const rows = stmt.all() as Array<{
		id: number;
		nid: number;
		did: number;
		ord: number;
		mod: number;
		type: number;
		queue: number;
		due: number;
		ivl: number;
		factor: number;
		reps: number;
		lapses: number;
	}>;

	return rows.map((row) => ({
		id: row.id,
		nid: row.nid,
		did: row.did,
		ord: row.ord,
		mod: row.mod,
		type: row.type,
		queue: row.queue,
		due: row.due,
		ivl: row.ivl,
		factor: row.factor,
		reps: row.reps,
		lapses: row.lapses,
	}));
}

/**
 * Parse collection metadata (decks and models)
 */
function parseCollection(db: DatabaseSync): {
	decks: AnkiDeck[];
	models: AnkiModel[];
} {
	const stmt = db.prepare("SELECT decks, models FROM col LIMIT 1");
	const row = stmt.get() as { decks: string; models: string } | undefined;

	if (!row) {
		throw new Error("No collection data found in database");
	}

	// Parse decks JSON
	const decksJson = JSON.parse(row.decks) as Record<
		string,
		{ id: number; name: string; desc?: string }
	>;
	const decks: AnkiDeck[] = Object.values(decksJson).map((d) => ({
		id: d.id,
		name: d.name,
		description: d.desc || "",
	}));

	// Parse models JSON
	const modelsJson = JSON.parse(row.models) as Record<
		string,
		{
			id: number;
			name: string;
			flds: Array<{ name: string }>;
			tmpls: Array<{ name: string; qfmt: string; afmt: string }>;
		}
	>;
	const models: AnkiModel[] = Object.values(modelsJson).map((m) => ({
		id: m.id,
		name: m.name,
		fields: m.flds.map((f) => f.name),
		templates: m.tmpls.map((t) => ({
			name: t.name,
			qfmt: t.qfmt,
			afmt: t.afmt,
		})),
	}));

	return { decks, models };
}

/**
 * Get the list of files in a ZIP archive
 */
export async function listAnkiPackageContents(
	filePath: string,
): Promise<string[]> {
	const entries = await parseZip(filePath);
	return Array.from(entries.keys());
}
