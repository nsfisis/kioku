/**
 * Mulberry32 seeded PRNG.
 * Returns a function that produces deterministic values in [0, 1).
 */
export function createSeededRandom(seed: number): () => number {
	let s = seed | 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Fisher-Yates shuffle algorithm.
 * Returns a new shuffled array (does not mutate the original).
 * Accepts an optional `random` function for deterministic shuffling.
 */
export function shuffle<T>(
	array: T[],
	random: () => number = Math.random,
): T[] {
	const result = [...array];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		const temp = result[i] as T;
		result[i] = result[j] as T;
		result[j] = temp;
	}
	return result;
}
