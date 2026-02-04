/**
 * Returns the start-of-day boundary for the current study day.
 *
 * The "study day" is defined as 3:00 AM to the next day's 3:00 AM.
 *
 * - If current time >= 3:00 AM, start = today 3:00 AM local time
 * - If current time < 3:00 AM, start = yesterday 3:00 AM local time
 */
export function getStartOfStudyDayBoundary(now: Date = new Date()): Date {
	const boundary = new Date(now);
	boundary.setMinutes(0, 0, 0);

	if (boundary.getHours() < 3) {
		// Move to previous day
		boundary.setDate(boundary.getDate() - 1);
	}

	boundary.setHours(3);
	return boundary;
}

/**
 * Returns the end-of-day boundary for due card comparison.
 *
 * The "study day" is defined as 3:00 AM to the next day's 3:00 AM.
 * All cards with `due < boundary` are considered due for the current study day.
 *
 * - If current time >= 3:00 AM, boundary = tomorrow 3:00 AM local time
 * - If current time < 3:00 AM, boundary = today 3:00 AM local time
 */
export function getEndOfStudyDayBoundary(now: Date = new Date()): Date {
	const boundary = new Date(now);
	boundary.setMinutes(0, 0, 0);

	if (boundary.getHours() >= 3) {
		// Move to next day
		boundary.setDate(boundary.getDate() + 1);
	}

	boundary.setHours(3);
	return boundary;
}
