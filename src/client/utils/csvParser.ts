/**
 * CSV Parser utility for importing notes
 * Handles RFC 4180 compliant CSV parsing with:
 * - Quoted fields containing commas or newlines
 * - Escaped quotes ("")
 * - Different line endings (CRLF, LF)
 */

export interface CSVParseResult {
	headers: string[];
	rows: Record<string, string>[];
}

export interface CSVParseError {
	message: string;
	line?: number;
}

export type CSVParseOutcome =
	| { success: true; data: CSVParseResult }
	| { success: false; error: CSVParseError };

/**
 * Parse a CSV string into headers and rows
 */
export function parseCSV(content: string): CSVParseOutcome {
	const lines = splitCSVLines(content);

	if (lines.length === 0) {
		return { success: false, error: { message: "CSV file is empty" } };
	}

	const headerLine = lines[0];
	if (!headerLine) {
		return { success: false, error: { message: "CSV file is empty" } };
	}

	const headers = parseCSVLine(headerLine);
	if (headers.length === 0) {
		return { success: false, error: { message: "CSV header is empty" } };
	}

	const rows: Record<string, string>[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;

		// Skip empty lines
		if (line.trim() === "") {
			continue;
		}

		const values = parseCSVLine(line);

		if (values.length !== headers.length) {
			return {
				success: false,
				error: {
					message: `Row ${i + 1}: Expected ${headers.length} columns, got ${values.length}`,
					line: i + 1,
				},
			};
		}

		const row: Record<string, string> = {};
		for (let j = 0; j < headers.length; j++) {
			const header = headers[j];
			const value = values[j];
			if (header !== undefined && value !== undefined) {
				row[header] = value;
			}
		}
		rows.push(row);
	}

	return { success: true, data: { headers, rows } };
}

/**
 * Split CSV content into logical lines, handling quoted fields with newlines
 */
function splitCSVLines(content: string): string[] {
	const lines: string[] = [];
	let currentLine = "";
	let inQuotes = false;

	// Normalize line endings to \n
	const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

	for (let i = 0; i < normalized.length; i++) {
		const char = normalized[i];

		if (char === '"') {
			// Check for escaped quote ("")
			if (inQuotes && normalized[i + 1] === '"') {
				currentLine += '""';
				i++; // Skip next quote
			} else {
				inQuotes = !inQuotes;
				currentLine += char;
			}
		} else if (char === "\n" && !inQuotes) {
			lines.push(currentLine);
			currentLine = "";
		} else {
			currentLine += char;
		}
	}

	// Don't forget the last line
	if (currentLine.length > 0) {
		lines.push(currentLine);
	}

	return lines;
}

/**
 * Parse a single CSV line into an array of values
 */
function parseCSVLine(line: string): string[] {
	const values: string[] = [];
	let currentValue = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			if (!inQuotes) {
				// Start of quoted field
				inQuotes = true;
			} else if (line[i + 1] === '"') {
				// Escaped quote
				currentValue += '"';
				i++; // Skip next quote
			} else {
				// End of quoted field
				inQuotes = false;
			}
		} else if (char === "," && !inQuotes) {
			values.push(currentValue.trim());
			currentValue = "";
		} else {
			currentValue += char;
		}
	}

	// Don't forget the last value
	values.push(currentValue.trim());

	return values;
}
