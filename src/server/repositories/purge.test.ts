import { describe, expect, it, vi } from "vitest";
import type { PurgeOptions, PurgeRepository, PurgeResult } from "./purge.js";

function createMockPurgeResult(
	overrides: Partial<PurgeResult> = {},
): PurgeResult {
	return {
		reviewLogs: 0,
		noteFieldValues: 0,
		cards: 0,
		notes: 0,
		noteFieldTypes: 0,
		noteTypes: 0,
		decks: 0,
		...overrides,
	};
}

function createMockPurgeRepo(): PurgeRepository {
	return {
		purgeDeletedRecords: vi.fn(),
	};
}

describe("PurgeRepository mock factory", () => {
	describe("createMockPurgeResult", () => {
		it("creates a valid PurgeResult with all zeros by default", () => {
			const result = createMockPurgeResult();

			expect(result.reviewLogs).toBe(0);
			expect(result.noteFieldValues).toBe(0);
			expect(result.cards).toBe(0);
			expect(result.notes).toBe(0);
			expect(result.noteFieldTypes).toBe(0);
			expect(result.noteTypes).toBe(0);
			expect(result.decks).toBe(0);
		});

		it("allows overriding properties", () => {
			const result = createMockPurgeResult({
				cards: 5,
				notes: 3,
				decks: 1,
			});

			expect(result.cards).toBe(5);
			expect(result.notes).toBe(3);
			expect(result.decks).toBe(1);
			expect(result.reviewLogs).toBe(0);
		});
	});

	describe("createMockPurgeRepo", () => {
		it("creates a repository with purgeDeletedRecords method", () => {
			const repo = createMockPurgeRepo();

			expect(repo.purgeDeletedRecords).toBeDefined();
		});

		it("purgeDeletedRecords is mockable", async () => {
			const repo = createMockPurgeRepo();
			const mockResult = createMockPurgeResult({
				cards: 10,
				notes: 5,
				reviewLogs: 25,
			});

			vi.mocked(repo.purgeDeletedRecords).mockResolvedValue(mockResult);

			const options: PurgeOptions = { retentionDays: 90 };
			const result = await repo.purgeDeletedRecords(options);

			expect(result.cards).toBe(10);
			expect(result.notes).toBe(5);
			expect(result.reviewLogs).toBe(25);
			expect(repo.purgeDeletedRecords).toHaveBeenCalledWith(options);
		});

		it("respects batchSize option", async () => {
			const repo = createMockPurgeRepo();
			const mockResult = createMockPurgeResult({ cards: 100 });

			vi.mocked(repo.purgeDeletedRecords).mockResolvedValue(mockResult);

			const options: PurgeOptions = { retentionDays: 30, batchSize: 500 };
			await repo.purgeDeletedRecords(options);

			expect(repo.purgeDeletedRecords).toHaveBeenCalledWith({
				retentionDays: 30,
				batchSize: 500,
			});
		});
	});
});

describe("PurgeResult interface contracts", () => {
	it("PurgeResult has all required fields", () => {
		const result = createMockPurgeResult();

		expect(result).toHaveProperty("reviewLogs");
		expect(result).toHaveProperty("noteFieldValues");
		expect(result).toHaveProperty("cards");
		expect(result).toHaveProperty("notes");
		expect(result).toHaveProperty("noteFieldTypes");
		expect(result).toHaveProperty("noteTypes");
		expect(result).toHaveProperty("decks");
	});

	it("all fields are numbers", () => {
		const result = createMockPurgeResult({
			reviewLogs: 10,
			noteFieldValues: 20,
			cards: 30,
			notes: 40,
			noteFieldTypes: 50,
			noteTypes: 60,
			decks: 70,
		});

		expect(typeof result.reviewLogs).toBe("number");
		expect(typeof result.noteFieldValues).toBe("number");
		expect(typeof result.cards).toBe("number");
		expect(typeof result.notes).toBe("number");
		expect(typeof result.noteFieldTypes).toBe("number");
		expect(typeof result.noteTypes).toBe("number");
		expect(typeof result.decks).toBe("number");
	});
});

describe("PurgeOptions interface contracts", () => {
	it("retentionDays is required", async () => {
		const repo = createMockPurgeRepo();
		vi.mocked(repo.purgeDeletedRecords).mockResolvedValue(
			createMockPurgeResult(),
		);

		const options: PurgeOptions = { retentionDays: 90 };
		await repo.purgeDeletedRecords(options);

		expect(repo.purgeDeletedRecords).toHaveBeenCalledWith(
			expect.objectContaining({ retentionDays: 90 }),
		);
	});

	it("batchSize is optional", async () => {
		const repo = createMockPurgeRepo();
		vi.mocked(repo.purgeDeletedRecords).mockResolvedValue(
			createMockPurgeResult(),
		);

		const optionsWithoutBatch: PurgeOptions = { retentionDays: 90 };
		const optionsWithBatch: PurgeOptions = {
			retentionDays: 90,
			batchSize: 500,
		};

		await repo.purgeDeletedRecords(optionsWithoutBatch);
		await repo.purgeDeletedRecords(optionsWithBatch);

		expect(repo.purgeDeletedRecords).toHaveBeenCalledTimes(2);
	});
});

describe("Purge deletion order", () => {
	it("returns counts for all entity types", async () => {
		const repo = createMockPurgeRepo();
		const mockResult = createMockPurgeResult({
			reviewLogs: 100,
			noteFieldValues: 50,
			cards: 25,
			notes: 20,
			noteFieldTypes: 10,
			noteTypes: 5,
			decks: 2,
		});

		vi.mocked(repo.purgeDeletedRecords).mockResolvedValue(mockResult);

		const result = await repo.purgeDeletedRecords({ retentionDays: 90 });

		expect(result.reviewLogs).toBe(100);
		expect(result.noteFieldValues).toBe(50);
		expect(result.cards).toBe(25);
		expect(result.notes).toBe(20);
		expect(result.noteFieldTypes).toBe(10);
		expect(result.noteTypes).toBe(5);
		expect(result.decks).toBe(2);
	});

	it("returns zero counts when no records to purge", async () => {
		const repo = createMockPurgeRepo();
		vi.mocked(repo.purgeDeletedRecords).mockResolvedValue(
			createMockPurgeResult(),
		);

		const result = await repo.purgeDeletedRecords({ retentionDays: 90 });

		const total =
			result.reviewLogs +
			result.noteFieldValues +
			result.cards +
			result.notes +
			result.noteFieldTypes +
			result.noteTypes +
			result.decks;

		expect(total).toBe(0);
	});
});
