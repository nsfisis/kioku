import { describe, expect, it } from "vitest";
import { createSeededRandom, shuffle } from "./random";

describe("shuffle", () => {
	it("returns an array of the same length", () => {
		const input = [1, 2, 3, 4, 5];
		const result = shuffle(input);
		expect(result).toHaveLength(input.length);
	});

	it("contains all original elements", () => {
		const input = [1, 2, 3, 4, 5];
		const result = shuffle(input);
		expect(result.sort()).toEqual(input.sort());
	});

	it("does not mutate the original array", () => {
		const input = [1, 2, 3, 4, 5];
		const original = [...input];
		shuffle(input);
		expect(input).toEqual(original);
	});

	it("returns empty array for empty input", () => {
		expect(shuffle([])).toEqual([]);
	});

	it("returns single element array unchanged", () => {
		expect(shuffle([1])).toEqual([1]);
	});

	it("works with objects", () => {
		const input = [{ id: 1 }, { id: 2 }, { id: 3 }];
		const result = shuffle(input);
		expect(result).toHaveLength(3);
		expect(result.map((x) => x.id).sort()).toEqual([1, 2, 3]);
	});

	it("produces deterministic result with seeded random", () => {
		const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const seed = 12345;
		const result1 = shuffle(input, createSeededRandom(seed));
		const result2 = shuffle(input, createSeededRandom(seed));
		expect(result1).toEqual(result2);
	});

	it("produces different results with different seeds", () => {
		const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		const result1 = shuffle(input, createSeededRandom(1));
		const result2 = shuffle(input, createSeededRandom(2));
		expect(result1).not.toEqual(result2);
	});

	it("actually shuffles (statistical test)", () => {
		const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
		let sameOrderCount = 0;
		const iterations = 100;

		for (let i = 0; i < iterations; i++) {
			const result = shuffle(input);
			if (JSON.stringify(result) === JSON.stringify(input)) {
				sameOrderCount++;
			}
		}

		// Should very rarely keep original order (probability ~1/3628800)
		expect(sameOrderCount).toBeLessThan(iterations * 0.1);
	});
});
