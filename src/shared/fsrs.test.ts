import { describe, expect, it } from "vitest";
import { computeNextSchedule, type ScheduleInput } from "./fsrs";

const baseCard: ScheduleInput = {
	state: 0,
	due: new Date("2026-05-01T00:00:00Z"),
	stability: 0,
	difficulty: 0,
	elapsedDays: 0,
	scheduledDays: 0,
	reps: 0,
	lapses: 0,
	lastReview: null,
};

describe("computeNextSchedule", () => {
	it("schedules a new card forward when rated Good", () => {
		const now = new Date("2026-05-02T10:00:00Z");
		const result = computeNextSchedule(baseCard, 3, now);

		expect(result.reps).toBe(1);
		expect(result.lastReview.getTime()).toBe(now.getTime());
		expect(result.due.getTime()).toBeGreaterThan(now.getTime());
		expect(result.stability).toBeGreaterThan(0);
		expect(result.difficulty).toBeGreaterThan(0);
	});

	it("counts a lapse when a Review-state card is rated Again", () => {
		const card: ScheduleInput = {
			state: 2,
			due: new Date("2026-05-01T00:00:00Z"),
			stability: 10,
			difficulty: 5,
			elapsedDays: 5,
			scheduledDays: 5,
			reps: 3,
			lapses: 0,
			lastReview: new Date("2026-04-26T00:00:00Z"),
		};
		const now = new Date("2026-05-02T10:00:00Z");
		const result = computeNextSchedule(card, 1, now);

		expect(result.lapses).toBe(1);
	});

	it("computes reviewElapsedDays from previous lastReview", () => {
		const lastReview = new Date("2026-04-29T00:00:00Z");
		const card: ScheduleInput = {
			...baseCard,
			state: 2,
			stability: 5,
			difficulty: 5,
			lastReview,
			reps: 1,
		};
		const now = new Date("2026-05-02T00:00:00Z");
		const result = computeNextSchedule(card, 3, now);

		expect(result.reviewElapsedDays).toBe(3);
	});

	it("uses 0 reviewElapsedDays for a card without lastReview", () => {
		const now = new Date("2026-05-02T00:00:00Z");
		const result = computeNextSchedule(baseCard, 3, now);

		expect(result.reviewElapsedDays).toBe(0);
	});

	it("higher ratings yield longer scheduled intervals than lower ratings", () => {
		const card: ScheduleInput = {
			state: 2,
			due: new Date("2026-05-01T00:00:00Z"),
			stability: 10,
			difficulty: 5,
			elapsedDays: 10,
			scheduledDays: 10,
			reps: 5,
			lapses: 0,
			lastReview: new Date("2026-04-21T00:00:00Z"),
		};
		const now = new Date("2026-05-02T00:00:00Z");

		const hard = computeNextSchedule(card, 2, now);
		const good = computeNextSchedule(card, 3, now);
		const easy = computeNextSchedule(card, 4, now);

		expect(easy.scheduledDays).toBeGreaterThanOrEqual(good.scheduledDays);
		expect(good.scheduledDays).toBeGreaterThanOrEqual(hard.scheduledDays);
	});
});
