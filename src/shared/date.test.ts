import { describe, expect, it } from "vitest";
import { getEndOfStudyDayBoundary } from "./date";

describe("getEndOfStudyDayBoundary", () => {
	it("should return next day 3:00 AM when current time is after 3:00 AM", () => {
		// Feb 2, 2026 10:00 AM
		const now = new Date(2026, 1, 2, 10, 0, 0, 0);
		const boundary = getEndOfStudyDayBoundary(now);

		expect(boundary.getFullYear()).toBe(2026);
		expect(boundary.getMonth()).toBe(1);
		expect(boundary.getDate()).toBe(3);
		expect(boundary.getHours()).toBe(3);
		expect(boundary.getMinutes()).toBe(0);
		expect(boundary.getSeconds()).toBe(0);
	});

	it("should return today 3:00 AM when current time is before 3:00 AM", () => {
		// Feb 2, 2026 1:30 AM
		const now = new Date(2026, 1, 2, 1, 30, 0, 0);
		const boundary = getEndOfStudyDayBoundary(now);

		expect(boundary.getFullYear()).toBe(2026);
		expect(boundary.getMonth()).toBe(1);
		expect(boundary.getDate()).toBe(2);
		expect(boundary.getHours()).toBe(3);
		expect(boundary.getMinutes()).toBe(0);
		expect(boundary.getSeconds()).toBe(0);
	});

	it("should return next day 3:00 AM when current time is exactly 3:00 AM", () => {
		// Feb 2, 2026 3:00 AM
		const now = new Date(2026, 1, 2, 3, 0, 0, 0);
		const boundary = getEndOfStudyDayBoundary(now);

		expect(boundary.getDate()).toBe(3);
		expect(boundary.getHours()).toBe(3);
	});

	it("should return next day 3:00 AM when current time is 11:59 PM", () => {
		// Feb 2, 2026 11:59 PM
		const now = new Date(2026, 1, 2, 23, 59, 0, 0);
		const boundary = getEndOfStudyDayBoundary(now);

		expect(boundary.getDate()).toBe(3);
		expect(boundary.getHours()).toBe(3);
	});

	it("should handle month boundaries correctly", () => {
		// Jan 31, 2026 15:00
		const now = new Date(2026, 0, 31, 15, 0, 0, 0);
		const boundary = getEndOfStudyDayBoundary(now);

		expect(boundary.getMonth()).toBe(1); // February
		expect(boundary.getDate()).toBe(1);
		expect(boundary.getHours()).toBe(3);
	});
});
