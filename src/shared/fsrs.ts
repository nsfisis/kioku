import {
	type Card as FSRSCard,
	type State as FSRSState,
	fsrs,
	type Grade,
} from "ts-fsrs";

const f = fsrs({ enable_fuzz: true });

export interface ScheduleInput {
	state: number;
	due: Date;
	stability: number;
	difficulty: number;
	elapsedDays: number;
	scheduledDays: number;
	reps: number;
	lapses: number;
	lastReview: Date | null;
}

export interface ScheduleResult {
	state: number;
	due: Date;
	stability: number;
	difficulty: number;
	elapsedDays: number;
	scheduledDays: number;
	reps: number;
	lapses: number;
	lastReview: Date;
	/** Days elapsed since the previous review (for ReviewLog). */
	reviewElapsedDays: number;
}

export function computeNextSchedule(
	card: ScheduleInput,
	rating: 1 | 2 | 3 | 4,
	now: Date,
): ScheduleResult {
	const fsrsCard: FSRSCard = {
		due: card.due,
		stability: card.stability,
		difficulty: card.difficulty,
		elapsed_days: card.elapsedDays,
		scheduled_days: card.scheduledDays,
		reps: card.reps,
		lapses: card.lapses,
		state: card.state as FSRSState,
		last_review: card.lastReview ?? undefined,
		learning_steps: 0,
	};

	const result = f.next(fsrsCard, now, rating as Grade);

	const reviewElapsedDays = card.lastReview
		? Math.round(
				(now.getTime() - card.lastReview.getTime()) / (1000 * 60 * 60 * 24),
			)
		: 0;

	return {
		state: result.card.state,
		due: result.card.due,
		stability: result.card.stability,
		difficulty: result.card.difficulty,
		elapsedDays: result.card.elapsed_days,
		scheduledDays: result.card.scheduled_days,
		reps: result.card.reps,
		lapses: result.card.lapses,
		lastReview: now,
		reviewElapsedDays,
	};
}
