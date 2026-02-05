import { purgeRepository } from "../repositories/index.js";

const DEFAULT_RETENTION_DAYS = 90;
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function runPurge(): Promise<void> {
	try {
		const result = await purgeRepository.purgeDeletedRecords({
			retentionDays: DEFAULT_RETENTION_DAYS,
		});

		const total =
			result.reviewLogs +
			result.noteFieldValues +
			result.cards +
			result.notes +
			result.noteFieldTypes +
			result.noteTypes +
			result.decks;

		console.log(`[Purge] Completed: ${total} records deleted`);
		if (total > 0) {
			console.log(
				`[Purge] Details: reviewLogs=${result.reviewLogs}, noteFieldValues=${result.noteFieldValues}, cards=${result.cards}, notes=${result.notes}, noteFieldTypes=${result.noteFieldTypes}, noteTypes=${result.noteTypes}, decks=${result.decks}`,
			);
		}
	} catch (error) {
		console.error("[Purge] Failed:", error);
	}
}

export function startPurgeScheduler(): void {
	// Run immediately on startup
	runPurge();

	// Schedule to run every 24 hours
	setInterval(runPurge, PURGE_INTERVAL_MS);
}
