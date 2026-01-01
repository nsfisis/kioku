import { describe, expect, it } from "vitest";
import { parseCSV } from "./csvParser";

describe("parseCSV", () => {
	it("parses simple CSV with headers", () => {
		const csv = `deck,note_type,Front,Back
English,Basic,hello,world
English,Basic,goodbye,farewell`;

		const result = parseCSV(csv);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.headers).toEqual([
				"deck",
				"note_type",
				"Front",
				"Back",
			]);
			expect(result.data.rows).toHaveLength(2);
			expect(result.data.rows[0]).toEqual({
				deck: "English",
				note_type: "Basic",
				Front: "hello",
				Back: "world",
			});
			expect(result.data.rows[1]).toEqual({
				deck: "English",
				note_type: "Basic",
				Front: "goodbye",
				Back: "farewell",
			});
		}
	});

	it("handles quoted fields with commas", () => {
		const csv = `deck,note_type,Front,Back
English,Basic,"hello, world","foo, bar"`;

		const result = parseCSV(csv);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.rows[0]).toEqual({
				deck: "English",
				note_type: "Basic",
				Front: "hello, world",
				Back: "foo, bar",
			});
		}
	});

	it("handles quoted fields with newlines", () => {
		const csv = `deck,note_type,Front,Back
English,Basic,"line1
line2","back"`;

		const result = parseCSV(csv);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.rows).toHaveLength(1);
			expect(result.data.rows[0]).toEqual({
				deck: "English",
				note_type: "Basic",
				Front: "line1\nline2",
				Back: "back",
			});
		}
	});

	it("handles escaped quotes", () => {
		const csv = `deck,note_type,Front,Back
English,Basic,"say ""hello""",world`;

		const result = parseCSV(csv);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.rows[0]).toEqual({
				deck: "English",
				note_type: "Basic",
				Front: 'say "hello"',
				Back: "world",
			});
		}
	});

	it("skips empty lines", () => {
		const csv = `deck,note_type,Front,Back
English,Basic,hello,world

English,Basic,goodbye,farewell
`;

		const result = parseCSV(csv);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.rows).toHaveLength(2);
		}
	});

	it("handles CRLF line endings", () => {
		const csv = "deck,note_type,Front,Back\r\nEnglish,Basic,hello,world\r\n";

		const result = parseCSV(csv);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.rows).toHaveLength(1);
			expect(result.data.rows[0]).toEqual({
				deck: "English",
				note_type: "Basic",
				Front: "hello",
				Back: "world",
			});
		}
	});

	it("returns error for empty file", () => {
		const result = parseCSV("");

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.message).toBe("CSV file is empty");
		}
	});

	it("returns error for inconsistent column count", () => {
		const csv = `deck,note_type,Front,Back
English,Basic,hello`;

		const result = parseCSV(csv);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.message).toBe("Row 2: Expected 4 columns, got 3");
			expect(result.error.line).toBe(2);
		}
	});

	it("trims whitespace from values", () => {
		const csv = `deck,note_type,Front,Back
English , Basic , hello , world `;

		const result = parseCSV(csv);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.rows[0]).toEqual({
				deck: "English",
				note_type: "Basic",
				Front: "hello",
				Back: "world",
			});
		}
	});
});
