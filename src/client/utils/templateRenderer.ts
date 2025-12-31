/**
 * Custom mustache-like template renderer for card display.
 *
 * Syntax: `{{FieldName}}` is replaced with the corresponding field value.
 *
 * Features:
 * - Simple `{{FieldName}}` replacement
 * - Case-sensitive field matching
 * - Missing fields are replaced with empty string
 * - Whitespace around field names is trimmed: `{{ Front }}` works like `{{Front}}`
 *
 * Examples:
 * - Simple: `{{Front}}` → "What is the capital of Japan?"
 * - With text: `Q: {{Front}}` → "Q: What is the capital of Japan?"
 * - Multiple fields: `{{Word}} - {{Reading}}` → "日本語 - にほんご"
 */

/**
 * Regex to match mustache-style placeholders: {{fieldName}}
 * Captures the field name (with optional whitespace that will be trimmed)
 */
const TEMPLATE_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;

/**
 * Field values for template rendering.
 * Keys are field names, values are the corresponding content.
 */
export type FieldValues = Record<string, string>;

/**
 * Renders a mustache-like template by replacing `{{FieldName}}` placeholders
 * with corresponding values from the fieldValues object.
 *
 * @param template - The template string with `{{FieldName}}` placeholders
 * @param fieldValues - Object mapping field names to their values
 * @returns The rendered string with all placeholders replaced
 *
 * @example
 * ```typescript
 * renderTemplate("{{Front}}", { Front: "Hello" })
 * // Returns: "Hello"
 *
 * renderTemplate("Q: {{Question}}\nHint: {{Hint}}", {
 *   Question: "What is 2+2?",
 *   Hint: "It's even"
 * })
 * // Returns: "Q: What is 2+2?\nHint: It's even"
 * ```
 */
export function renderTemplate(
	template: string,
	fieldValues: FieldValues,
): string {
	return template.replace(TEMPLATE_PATTERN, (_, fieldName: string) => {
		const trimmedName = fieldName.trim();
		return fieldValues[trimmedName] ?? "";
	});
}

/**
 * Extracts all field names used in a template.
 *
 * @param template - The template string to analyze
 * @returns Array of unique field names found in the template
 *
 * @example
 * ```typescript
 * extractFieldNames("{{Front}} and {{Back}}")
 * // Returns: ["Front", "Back"]
 *
 * extractFieldNames("{{Word}} - {{Word}}")
 * // Returns: ["Word"] (duplicates removed)
 * ```
 */
export function extractFieldNames(template: string): string[] {
	const names = new Set<string>();

	// Use matchAll to get all matches without assignment in loop
	const matches = template.matchAll(TEMPLATE_PATTERN);
	for (const match of matches) {
		const fieldName = match[1];
		if (fieldName) {
			names.add(fieldName.trim());
		}
	}

	return Array.from(names);
}

/**
 * Validates that all field names used in a template exist in the provided field values.
 *
 * @param template - The template string to validate
 * @param fieldValues - Object mapping field names to their values
 * @returns Object with `valid` boolean and `missingFields` array if invalid
 *
 * @example
 * ```typescript
 * validateTemplate("{{Front}}", { Front: "Hello" })
 * // Returns: { valid: true, missingFields: [] }
 *
 * validateTemplate("{{Front}} {{Back}}", { Front: "Hello" })
 * // Returns: { valid: false, missingFields: ["Back"] }
 * ```
 */
export function validateTemplate(
	template: string,
	fieldValues: FieldValues,
): { valid: boolean; missingFields: string[] } {
	const usedFields = extractFieldNames(template);
	const availableFields = new Set(Object.keys(fieldValues));
	const missingFields = usedFields.filter(
		(field) => !availableFields.has(field),
	);

	return {
		valid: missingFields.length === 0,
		missingFields,
	};
}

/**
 * Options for rendering a card's display content.
 */
export interface RenderCardOptions {
	/** The front template (e.g., "{{Front}}") */
	frontTemplate: string;
	/** The back template (e.g., "{{Back}}") */
	backTemplate: string;
	/** Field values from the note */
	fieldValues: FieldValues;
	/** Whether this is a reversed card */
	isReversed: boolean;
}

/**
 * Renders a card's front and back content based on templates and note field values.
 *
 * For normal cards (isReversed = false):
 * - Front: Render frontTemplate
 * - Back: Render backTemplate
 *
 * For reversed cards (isReversed = true):
 * - Front: Render backTemplate
 * - Back: Render frontTemplate
 *
 * @param options - The rendering options
 * @returns Object with rendered `front` and `back` strings
 *
 * @example
 * ```typescript
 * // Normal card
 * renderCard({
 *   frontTemplate: "{{Front}}",
 *   backTemplate: "{{Back}}",
 *   fieldValues: { Front: "Question", Back: "Answer" },
 *   isReversed: false
 * })
 * // Returns: { front: "Question", back: "Answer" }
 *
 * // Reversed card
 * renderCard({
 *   frontTemplate: "{{Front}}",
 *   backTemplate: "{{Back}}",
 *   fieldValues: { Front: "Question", Back: "Answer" },
 *   isReversed: true
 * })
 * // Returns: { front: "Answer", back: "Question" }
 * ```
 */
export function renderCard(options: RenderCardOptions): {
	front: string;
	back: string;
} {
	const { frontTemplate, backTemplate, fieldValues, isReversed } = options;

	if (isReversed) {
		return {
			front: renderTemplate(backTemplate, fieldValues),
			back: renderTemplate(frontTemplate, fieldValues),
		};
	}

	return {
		front: renderTemplate(frontTemplate, fieldValues),
		back: renderTemplate(backTemplate, fieldValues),
	};
}
