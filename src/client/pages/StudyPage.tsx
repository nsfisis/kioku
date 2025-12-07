import {
	faCheck,
	faChevronLeft,
	faCircleCheck,
	faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { ApiClientError, apiClient } from "../api";

interface Card {
	id: string;
	deckId: string;
	front: string;
	back: string;
	state: number;
	due: string;
	stability: number;
	difficulty: number;
	reps: number;
	lapses: number;
}

interface Deck {
	id: string;
	name: string;
}

type Rating = 1 | 2 | 3 | 4;

const RatingLabels: Record<Rating, string> = {
	1: "Again",
	2: "Hard",
	3: "Good",
	4: "Easy",
};

const RatingStyles: Record<Rating, string> = {
	1: "bg-again hover:bg-again/90 focus:ring-again/30",
	2: "bg-hard hover:bg-hard/90 focus:ring-hard/30",
	3: "bg-good hover:bg-good/90 focus:ring-good/30",
	4: "bg-easy hover:bg-easy/90 focus:ring-easy/30",
};

export function StudyPage() {
	const { deckId } = useParams<{ deckId: string }>();
	const [deck, setDeck] = useState<Deck | null>(null);
	const [cards, setCards] = useState<Card[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isFlipped, setIsFlipped] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [completedCount, setCompletedCount] = useState(0);
	const cardStartTimeRef = useRef<number>(Date.now());

	const fetchDeck = useCallback(async () => {
		if (!deckId) return;

		const authHeader = apiClient.getAuthHeader();
		if (!authHeader) {
			throw new ApiClientError("Not authenticated", 401);
		}

		const res = await fetch(`/api/decks/${deckId}`, {
			headers: authHeader,
		});

		if (!res.ok) {
			const errorBody = await res.json().catch(() => ({}));
			throw new ApiClientError(
				(errorBody as { error?: string }).error ||
					`Request failed with status ${res.status}`,
				res.status,
			);
		}

		const data = await res.json();
		setDeck(data.deck);
	}, [deckId]);

	const fetchDueCards = useCallback(async () => {
		if (!deckId) return;

		const authHeader = apiClient.getAuthHeader();
		if (!authHeader) {
			throw new ApiClientError("Not authenticated", 401);
		}

		const res = await fetch(`/api/decks/${deckId}/study`, {
			headers: authHeader,
		});

		if (!res.ok) {
			const errorBody = await res.json().catch(() => ({}));
			throw new ApiClientError(
				(errorBody as { error?: string }).error ||
					`Request failed with status ${res.status}`,
				res.status,
			);
		}

		const data = await res.json();
		setCards(data.cards);
	}, [deckId]);

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			await Promise.all([fetchDeck(), fetchDueCards()]);
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to load study session. Please try again.");
			}
		} finally {
			setIsLoading(false);
		}
	}, [fetchDeck, fetchDueCards]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Reset timer when card changes
	useEffect(() => {
		cardStartTimeRef.current = Date.now();
	}, [currentIndex]);

	const handleFlip = useCallback(() => {
		setIsFlipped(true);
	}, []);

	const handleRating = useCallback(
		async (rating: Rating) => {
			if (!deckId || isSubmitting) return;

			const currentCard = cards[currentIndex];
			if (!currentCard) return;

			setIsSubmitting(true);
			setError(null);

			const durationMs = Date.now() - cardStartTimeRef.current;

			try {
				const authHeader = apiClient.getAuthHeader();
				if (!authHeader) {
					throw new ApiClientError("Not authenticated", 401);
				}

				const res = await fetch(
					`/api/decks/${deckId}/study/${currentCard.id}`,
					{
						method: "POST",
						headers: {
							...authHeader,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ rating, durationMs }),
					},
				);

				if (!res.ok) {
					const errorBody = await res.json().catch(() => ({}));
					throw new ApiClientError(
						(errorBody as { error?: string }).error ||
							`Request failed with status ${res.status}`,
						res.status,
					);
				}

				setCompletedCount((prev) => prev + 1);
				setIsFlipped(false);
				setCurrentIndex((prev) => prev + 1);
			} catch (err) {
				if (err instanceof ApiClientError) {
					setError(err.message);
				} else {
					setError("Failed to submit review. Please try again.");
				}
			} finally {
				setIsSubmitting(false);
			}
		},
		[deckId, isSubmitting, cards, currentIndex],
	);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (isSubmitting) return;

			if (!isFlipped) {
				if (e.key === " " || e.key === "Enter") {
					e.preventDefault();
					handleFlip();
				}
			} else {
				const keyRatingMap: Record<string, Rating> = {
					"1": 1,
					"2": 2,
					"3": 3,
					"4": 4,
				};

				const rating = keyRatingMap[e.key];
				if (rating) {
					e.preventDefault();
					handleRating(rating);
				}
			}
		},
		[isFlipped, isSubmitting, handleFlip, handleRating],
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	if (!deckId) {
		return (
			<div className="min-h-screen bg-cream flex items-center justify-center">
				<div className="text-center">
					<p className="text-muted mb-4">Invalid deck ID</p>
					<Link
						href="/"
						className="text-primary hover:text-primary-dark font-medium"
					>
						Back to decks
					</Link>
				</div>
			</div>
		);
	}

	const currentCard = cards[currentIndex];
	const isSessionComplete = currentIndex >= cards.length && cards.length > 0;
	const hasNoCards = !isLoading && cards.length === 0;
	const remainingCards = cards.length - currentIndex;

	return (
		<div className="min-h-screen bg-cream flex flex-col">
			{/* Header */}
			<header className="bg-white border-b border-border/50 shrink-0">
				<div className="max-w-2xl mx-auto px-4 py-4">
					<Link
						href={`/decks/${deckId}`}
						className="inline-flex items-center gap-2 text-muted hover:text-slate transition-colors text-sm"
					>
						<FontAwesomeIcon
							icon={faChevronLeft}
							className="w-4 h-4"
							aria-hidden="true"
						/>
						Back to Deck
					</Link>
				</div>
			</header>

			{/* Main Content */}
			<main className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-6">
				{/* Loading State */}
				{isLoading && (
					<div className="flex-1 flex items-center justify-center">
						<FontAwesomeIcon
							icon={faSpinner}
							className="h-8 w-8 text-primary animate-spin"
							aria-hidden="true"
						/>
					</div>
				)}

				{/* Error State */}
				{error && (
					<div
						role="alert"
						className="bg-error/5 border border-error/20 rounded-xl p-4 flex items-center justify-between mb-4"
					>
						<span className="text-error">{error}</span>
						<button
							type="button"
							onClick={fetchData}
							className="text-error hover:text-error/80 font-medium text-sm"
						>
							Retry
						</button>
					</div>
				)}

				{/* Study Content */}
				{!isLoading && !error && deck && (
					<div className="flex-1 flex flex-col animate-fade-in">
						{/* Study Header */}
						<div className="flex items-center justify-between mb-6">
							<h1 className="font-display text-xl font-medium text-slate truncate">
								{deck.name}
							</h1>
							{!isSessionComplete && !hasNoCards && (
								<span
									data-testid="remaining-count"
									className="bg-ivory text-slate px-3 py-1 rounded-full text-sm font-medium"
								>
									{remainingCards} remaining
								</span>
							)}
						</div>

						{/* No Cards State */}
						{hasNoCards && (
							<div
								data-testid="no-cards"
								className="flex-1 flex items-center justify-center"
							>
								<div className="text-center py-12 px-6 bg-white rounded-2xl border border-border/50 shadow-card max-w-sm w-full">
									<div className="w-16 h-16 mx-auto mb-4 bg-success/10 rounded-2xl flex items-center justify-center">
										<FontAwesomeIcon
											icon={faCheck}
											className="w-8 h-8 text-success"
											aria-hidden="true"
										/>
									</div>
									<h2 className="font-display text-xl font-medium text-slate mb-2">
										All caught up!
									</h2>
									<p className="text-muted text-sm mb-6">
										No cards due for review right now
									</p>
									<Link
										href={`/decks/${deckId}`}
										className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-5 rounded-lg transition-all duration-200"
									>
										Back to Deck
									</Link>
								</div>
							</div>
						)}

						{/* Session Complete State */}
						{isSessionComplete && (
							<div
								data-testid="session-complete"
								className="flex-1 flex items-center justify-center"
							>
								<div className="text-center py-12 px-6 bg-white rounded-2xl border border-border/50 shadow-lg max-w-sm w-full animate-scale-in">
									<div className="w-20 h-20 mx-auto mb-6 bg-success/10 rounded-full flex items-center justify-center">
										<FontAwesomeIcon
											icon={faCircleCheck}
											className="w-10 h-10 text-success"
											aria-hidden="true"
										/>
									</div>
									<h2 className="font-display text-2xl font-semibold text-ink mb-2">
										Session Complete!
									</h2>
									<p className="text-muted mb-1">You reviewed</p>
									<p className="text-4xl font-display font-bold text-primary mb-1">
										<span data-testid="completed-count">{completedCount}</span>
									</p>
									<p className="text-muted mb-8">
										card{completedCount !== 1 ? "s" : ""}
									</p>
									<div className="flex flex-col sm:flex-row gap-3 justify-center">
										<Link
											href={`/decks/${deckId}`}
											className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-5 rounded-lg transition-all duration-200"
										>
											Back to Deck
										</Link>
										<Link
											href="/"
											className="inline-flex items-center justify-center gap-2 bg-ivory hover:bg-border text-slate font-medium py-2.5 px-5 rounded-lg transition-all duration-200"
										>
											All Decks
										</Link>
									</div>
								</div>
							</div>
						)}

						{/* Active Study Card */}
						{currentCard && !isSessionComplete && (
							<div data-testid="study-card" className="flex-1 flex flex-col">
								{/* Card */}
								<button
									type="button"
									data-testid="card-container"
									onClick={!isFlipped ? handleFlip : undefined}
									aria-label={
										isFlipped ? "Card showing answer" : "Click to reveal answer"
									}
									disabled={isFlipped}
									className={`flex-1 min-h-[280px] bg-white rounded-2xl border border-border/50 shadow-card p-8 flex flex-col items-center justify-center text-center transition-all duration-300 ${
										!isFlipped
											? "cursor-pointer hover:shadow-lg hover:border-primary/30 active:scale-[0.99]"
											: "bg-ivory/50"
									}`}
								>
									{!isFlipped ? (
										<>
											<p
												data-testid="card-front"
												className="text-xl md:text-2xl text-ink font-medium whitespace-pre-wrap break-words leading-relaxed"
											>
												{currentCard.front}
											</p>
											<p className="mt-8 text-muted text-sm flex items-center gap-2">
												<kbd className="px-2 py-0.5 bg-ivory rounded text-xs font-mono">
													Space
												</kbd>
												<span>or tap to reveal</span>
											</p>
										</>
									) : (
										<p
											data-testid="card-back"
											className="text-xl md:text-2xl text-ink font-medium whitespace-pre-wrap break-words leading-relaxed animate-fade-in"
										>
											{currentCard.back}
										</p>
									)}
								</button>

								{/* Rating Buttons */}
								{isFlipped && (
									<div
										data-testid="rating-buttons"
										className="mt-6 grid grid-cols-4 gap-2 animate-slide-up"
									>
										{([1, 2, 3, 4] as Rating[]).map((rating) => (
											<button
												key={rating}
												type="button"
												data-testid={`rating-${rating}`}
												onClick={() => handleRating(rating)}
												disabled={isSubmitting}
												className={`py-4 px-2 rounded-xl text-white font-medium transition-all duration-200 focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] ${RatingStyles[rating]}`}
											>
												<span className="block text-base font-semibold">
													{RatingLabels[rating]}
												</span>
												<span className="block text-xs opacity-80 mt-0.5">
													{rating}
												</span>
											</button>
										))}
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</main>
		</div>
	);
}
