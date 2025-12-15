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

/**
 * Represents a Kioku deck ready for import
 */
export interface KiokuDeck {
	name: string;
	description: string | null;
}

/**
 * Represents a Kioku card ready for import
 */
export interface KiokuCard {
	front: string;
	back: string;
	state: number;
	due: Date;
	stability: number;
	difficulty: number;
	elapsedDays: number;
	scheduledDays: number;
	reps: number;
	lapses: number;
	lastReview: Date | null;
}

/**
 * Represents the import data with deck and cards
 */
export interface KiokuImportData {
	deck: KiokuDeck;
	cards: KiokuCard[];
}

/**
 * Strip HTML tags from a string
 */
function stripHtml(html: string): string {
	// Replace <br> and <br/> with newlines
	let text = html.replace(/<br\s*\/?>/gi, "\n");
	// Replace </div>, </p>, </li> with newlines
	text = text.replace(/<\/(div|p|li)>/gi, "\n");
	// Remove all other HTML tags
	text = text.replace(/<[^>]*>/g, "");
	// Decode common HTML entities
	text = text
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'");
	// Normalize whitespace
	text = text.replace(/\n\s*\n/g, "\n").trim();
	return text;
}

/**
 * Convert Anki factor (0-10000) to FSRS difficulty (0-10)
 * Anki factor: 2500 = 250% ease = easy, lower = harder
 * FSRS difficulty: higher = harder
 */
function ankiFactorToFsrsDifficulty(factor: number): number {
	// Default Anki factor is 2500 (250% ease)
	// Range is typically 1300-2500+ (130% to 250%+)
	// FSRS difficulty is 0-10 where higher means harder

	if (factor === 0) {
		// New card, use default FSRS difficulty
		return 0;
	}

	// Convert: high factor (easy) -> low difficulty, low factor (hard) -> high difficulty
	// Map factor range [1300, 3500] to difficulty [8, 2]
	const minFactor = 1300;
	const maxFactor = 3500;
	const minDifficulty = 2;
	const maxDifficulty = 8;

	const clampedFactor = Math.max(minFactor, Math.min(maxFactor, factor));
	const normalized = (clampedFactor - minFactor) / (maxFactor - minFactor);
	// Invert: high factor -> low difficulty
	const difficulty =
		maxDifficulty - normalized * (maxDifficulty - minDifficulty);

	return Math.round(difficulty * 100) / 100;
}

/**
 * Estimate FSRS stability from Anki interval
 * Stability in FSRS roughly corresponds to the interval in days
 */
function ankiIntervalToFsrsStability(ivl: number, state: number): number {
	// For new cards, stability is 0
	if (state === 0) {
		return 0;
	}

	// For learning/relearning cards, use a small initial stability
	if (state === 1 || state === 3) {
		return Math.max(0.5, ivl);
	}

	// For review cards, stability approximates the interval
	return Math.max(1, ivl);
}

/**
 * Convert Anki due timestamp to a Date
 * Anki stores due differently based on card type:
 * - New cards: due is a position in the new queue (integer)
 * - Learning cards: due is Unix timestamp in seconds
 * - Review cards: due is days since collection creation
 */
function ankiDueToDate(
	due: number,
	cardType: number,
	collectionCreation?: number,
): Date {
	const now = new Date();

	if (cardType === 0) {
		// New card: due is queue position, return current time
		return now;
	}

	if (cardType === 1 || cardType === 3) {
		// Learning/Relearning: due is Unix timestamp in seconds
		if (due > 100000000) {
			// Sanity check for timestamp
			return new Date(due * 1000);
		}
		return now;
	}

	// Review card: due is days since collection creation
	if (collectionCreation) {
		const baseDate = new Date(collectionCreation * 1000);
		baseDate.setDate(baseDate.getDate() + due);
		return baseDate;
	}

	// Fallback: treat as days from now (roughly)
	const dueDate = new Date();
	dueDate.setDate(dueDate.getDate() + due);
	return dueDate;
}

/**
 * Convert an Anki package to Kioku import format
 * Groups cards by deck and maps note fields to front/back
 *
 * @param pkg The parsed Anki package
 * @param options Optional configuration for the mapping
 * @returns Array of decks with their cards ready for import
 */
export function mapAnkiToKioku(
	pkg: AnkiPackage,
	options?: {
		/** Skip the default Anki deck (id: 1) */
		skipDefaultDeck?: boolean;
		/** Collection creation timestamp (for accurate due date calculation) */
		collectionCreation?: number;
	},
): KiokuImportData[] {
	const skipDefaultDeck = options?.skipDefaultDeck ?? true;
	const collectionCreation = options?.collectionCreation;

	// Build lookup maps
	const noteById = new Map<number, AnkiNote>();
	for (const note of pkg.notes) {
		noteById.set(note.id, note);
	}

	const modelById = new Map<number, AnkiModel>();
	for (const model of pkg.models) {
		modelById.set(model.id, model);
	}

	const deckById = new Map<number, AnkiDeck>();
	for (const deck of pkg.decks) {
		deckById.set(deck.id, deck);
	}

	// Group cards by deck
	const cardsByDeck = new Map<number, AnkiCard[]>();
	for (const card of pkg.cards) {
		const existing = cardsByDeck.get(card.did) || [];
		existing.push(card);
		cardsByDeck.set(card.did, existing);
	}

	const result: KiokuImportData[] = [];

	for (const [deckId, ankiCards] of cardsByDeck) {
		// Skip default deck if configured
		if (skipDefaultDeck && deckId === 1) {
			continue;
		}

		const ankiDeck = deckById.get(deckId);
		if (!ankiDeck) {
			continue;
		}

		const kiokuDeck: KiokuDeck = {
			name: ankiDeck.name,
			description: ankiDeck.description || null,
		};

		const kiokuCards: KiokuCard[] = [];

		for (const ankiCard of ankiCards) {
			const note = noteById.get(ankiCard.nid);
			if (!note) {
				continue;
			}

			const model = modelById.get(note.mid);

			// Get front and back fields
			// For Basic model: fields[0] = Front, fields[1] = Back
			// For other models, we try to use the first two fields
			let front = note.fields[0] || "";
			let back = note.fields[1] || "";

			// If there's a template, try to identify question/answer fields
			if (model && model.templates.length > 0) {
				const template = model.templates[ankiCard.ord] || model.templates[0];
				if (template) {
					// Use template hints if available
					// For now, we just use the first two fields as front/back
					// A more sophisticated approach would parse the template
				}
			}

			// Strip HTML from fields
			front = stripHtml(front);
			back = stripHtml(back);

			// Map card state (Anki and FSRS use the same values: 0=New, 1=Learning, 2=Review, 3=Relearning)
			const state = ankiCard.type;

			const kiokuCard: KiokuCard = {
				front,
				back,
				state,
				due: ankiDueToDate(ankiCard.due, ankiCard.type, collectionCreation),
				stability: ankiIntervalToFsrsStability(ankiCard.ivl, ankiCard.type),
				difficulty: ankiFactorToFsrsDifficulty(ankiCard.factor),
				elapsedDays: ankiCard.ivl > 0 ? ankiCard.ivl : 0,
				scheduledDays: ankiCard.ivl,
				reps: ankiCard.reps,
				lapses: ankiCard.lapses,
				lastReview: ankiCard.reps > 0 ? new Date() : null, // We don't have exact last review time
			};

			kiokuCards.push(kiokuCard);
		}

		if (kiokuCards.length > 0) {
			result.push({ deck: kiokuDeck, cards: kiokuCards });
		}
	}

	return result;
}
