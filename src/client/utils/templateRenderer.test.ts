import { describe, expect, it } from "vitest";
import {
	extractFieldNames,
	renderCard,
	renderTemplate,
	validateTemplate,
} from "./templateRenderer";

describe("renderTemplate", () => {
	describe("basic replacement", () => {
		it("replaces a single field placeholder", () => {
			const result = renderTemplate("{{Front}}", { Front: "Hello" });
			expect(result).toBe("Hello");
		});

		it("replaces multiple different placeholders", () => {
			const result = renderTemplate("{{Front}} - {{Back}}", {
				Front: "Question",
				Back: "Answer",
			});
			expect(result).toBe("Question - Answer");
		});

		it("replaces duplicate placeholders", () => {
			const result = renderTemplate("{{Word}} means {{Word}}", {
				Word: "hello",
			});
			expect(result).toBe("hello means hello");
		});
	});

	describe("whitespace handling", () => {
		it("trims whitespace inside placeholders", () => {
			const result = renderTemplate("{{ Front }}", { Front: "Hello" });
			expect(result).toBe("Hello");
		});

		it("handles various whitespace patterns", () => {
			const result = renderTemplate("{{  Front  }} and {{Back }}", {
				Front: "A",
				Back: "B",
			});
			expect(result).toBe("A and B");
		});

		it("preserves whitespace in values", () => {
			const result = renderTemplate("{{Front}}", {
				Front: "  spaced  value  ",
			});
			expect(result).toBe("  spaced  value  ");
		});
	});

	describe("missing fields", () => {
		it("replaces missing field with empty string", () => {
			const result = renderTemplate("{{Missing}}", {});
			expect(result).toBe("");
		});

		it("replaces only missing fields with empty string", () => {
			const result = renderTemplate("{{Present}} and {{Missing}}", {
				Present: "Here",
			});
			expect(result).toBe("Here and ");
		});
	});

	describe("surrounding text", () => {
		it("preserves text before placeholder", () => {
			const result = renderTemplate("Q: {{Front}}", { Front: "Question" });
			expect(result).toBe("Q: Question");
		});

		it("preserves text after placeholder", () => {
			const result = renderTemplate("{{Front}} (answer below)", {
				Front: "Question",
			});
			expect(result).toBe("Question (answer below)");
		});

		it("handles complex templates with multiple fields and text", () => {
			const result = renderTemplate(
				"Word: {{Word}}\nReading: {{Reading}}\nMeaning: {{Meaning}}",
				{
					Word: "日本語",
					Reading: "にほんご",
					Meaning: "Japanese language",
				},
			);
			expect(result).toBe(
				"Word: 日本語\nReading: にほんご\nMeaning: Japanese language",
			);
		});
	});

	describe("edge cases", () => {
		it("returns empty string for empty template", () => {
			const result = renderTemplate("", { Front: "Hello" });
			expect(result).toBe("");
		});

		it("returns template unchanged when no placeholders", () => {
			const result = renderTemplate("Plain text", { Front: "Hello" });
			expect(result).toBe("Plain text");
		});

		it("handles special characters in field values", () => {
			const result = renderTemplate("{{Front}}", {
				Front: "Hello <script>alert('xss')</script>",
			});
			expect(result).toBe("Hello <script>alert('xss')</script>");
		});

		it("handles curly braces in values", () => {
			const result = renderTemplate("{{Front}}", {
				Front: "Object { key: value }",
			});
			expect(result).toBe("Object { key: value }");
		});

		it("handles adjacent braces with placeholder", () => {
			// {{{{Front}}}} - the pattern matches {{{{Front}} as a placeholder
			// with field name "{{Front", leaving trailing }}
			const result = renderTemplate("{{{{Front}}}}", { Front: "Hello" });
			// Since "{{Front" is not a defined field, it's replaced with empty string
			expect(result).toBe("}}");
		});

		it("handles leading braces as part of field name", () => {
			// If you actually define the field with braces, it works
			const result = renderTemplate("{{{{Front}}}}", { "{{Front": "Hello" });
			expect(result).toBe("Hello}}");
		});

		it("handles malformed placeholders", () => {
			// Single braces are not replaced
			const result = renderTemplate("{Front}", { Front: "Hello" });
			expect(result).toBe("{Front}");
		});

		it("handles empty field values", () => {
			const result = renderTemplate("{{Front}}", { Front: "" });
			expect(result).toBe("");
		});
	});

	describe("case sensitivity", () => {
		it("is case-sensitive for field names", () => {
			const result = renderTemplate("{{front}} {{Front}} {{FRONT}}", {
				front: "a",
				Front: "b",
				FRONT: "c",
			});
			expect(result).toBe("a b c");
		});

		it("does not match different case", () => {
			const result = renderTemplate("{{front}}", { Front: "Hello" });
			expect(result).toBe("");
		});
	});
});

describe("extractFieldNames", () => {
	it("extracts single field name", () => {
		const result = extractFieldNames("{{Front}}");
		expect(result).toEqual(["Front"]);
	});

	it("extracts multiple field names", () => {
		const result = extractFieldNames("{{Front}} and {{Back}}");
		expect(result).toContain("Front");
		expect(result).toContain("Back");
		expect(result).toHaveLength(2);
	});

	it("removes duplicates", () => {
		const result = extractFieldNames("{{Word}} and {{Word}} again");
		expect(result).toEqual(["Word"]);
	});

	it("trims whitespace from field names", () => {
		const result = extractFieldNames("{{ Front }} and {{Back }}");
		expect(result).toContain("Front");
		expect(result).toContain("Back");
	});

	it("returns empty array for no placeholders", () => {
		const result = extractFieldNames("Plain text");
		expect(result).toEqual([]);
	});

	it("returns empty array for empty template", () => {
		const result = extractFieldNames("");
		expect(result).toEqual([]);
	});
});

describe("validateTemplate", () => {
	it("returns valid when all fields exist", () => {
		const result = validateTemplate("{{Front}} {{Back}}", {
			Front: "Q",
			Back: "A",
		});
		expect(result).toEqual({ valid: true, missingFields: [] });
	});

	it("returns invalid with missing fields", () => {
		const result = validateTemplate("{{Front}} {{Back}} {{Extra}}", {
			Front: "Q",
		});
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("Back");
		expect(result.missingFields).toContain("Extra");
	});

	it("returns valid for template with no placeholders", () => {
		const result = validateTemplate("Plain text", {});
		expect(result).toEqual({ valid: true, missingFields: [] });
	});

	it("handles extra fields in values", () => {
		const result = validateTemplate("{{Front}}", {
			Front: "Q",
			Back: "A",
			Extra: "E",
		});
		expect(result).toEqual({ valid: true, missingFields: [] });
	});
});

describe("renderCard", () => {
	const fieldValues = {
		Front: "What is 2+2?",
		Back: "4",
	};

	describe("normal cards (isReversed = false)", () => {
		it("renders front with frontTemplate", () => {
			const result = renderCard({
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				fieldValues,
				isReversed: false,
			});
			expect(result.front).toBe("What is 2+2?");
		});

		it("renders back with backTemplate", () => {
			const result = renderCard({
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				fieldValues,
				isReversed: false,
			});
			expect(result.back).toBe("4");
		});

		it("handles templates with surrounding text", () => {
			const result = renderCard({
				frontTemplate: "Q: {{Front}}",
				backTemplate: "A: {{Back}}",
				fieldValues,
				isReversed: false,
			});
			expect(result.front).toBe("Q: What is 2+2?");
			expect(result.back).toBe("A: 4");
		});
	});

	describe("reversed cards (isReversed = true)", () => {
		it("renders front with backTemplate", () => {
			const result = renderCard({
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				fieldValues,
				isReversed: true,
			});
			expect(result.front).toBe("4");
		});

		it("renders back with frontTemplate", () => {
			const result = renderCard({
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				fieldValues,
				isReversed: true,
			});
			expect(result.back).toBe("What is 2+2?");
		});

		it("handles templates with surrounding text", () => {
			const result = renderCard({
				frontTemplate: "Q: {{Front}}",
				backTemplate: "A: {{Back}}",
				fieldValues,
				isReversed: true,
			});
			expect(result.front).toBe("A: 4");
			expect(result.back).toBe("Q: What is 2+2?");
		});
	});

	describe("complex templates", () => {
		it("handles multi-field templates", () => {
			const complexValues = {
				Word: "日本語",
				Reading: "にほんご",
				Meaning: "Japanese language",
			};

			const result = renderCard({
				frontTemplate: "{{Word}}\n({{Reading}})",
				backTemplate: "{{Meaning}}",
				fieldValues: complexValues,
				isReversed: false,
			});

			expect(result.front).toBe("日本語\n(にほんご)");
			expect(result.back).toBe("Japanese language");
		});

		it("handles reversed multi-field templates", () => {
			const complexValues = {
				Word: "日本語",
				Reading: "にほんご",
				Meaning: "Japanese language",
			};

			const result = renderCard({
				frontTemplate: "{{Word}}\n({{Reading}})",
				backTemplate: "{{Meaning}}",
				fieldValues: complexValues,
				isReversed: true,
			});

			expect(result.front).toBe("Japanese language");
			expect(result.back).toBe("日本語\n(にほんご)");
		});
	});
});
