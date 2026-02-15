import {
	faCheck,
	faChevronLeft,
	faCircleCheck,
	faPen,
	faRotateLeft,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAtomValue } from "jotai";
import {
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Link, useLocation, useParams } from "wouter";
import { ApiClientError, apiClient } from "../api";
import { studyDataAtomFamily } from "../atoms";
import { EditNoteModal } from "../components/EditNoteModal";
import { ErrorBoundary } from "../components/ErrorBoundary";
import type { CardStateType } from "../db";
import { queryClient } from "../queryClient";
import { renderCard } from "../utils/templateRenderer";

type Rating = 1 | 2 | 3 | 4;
type PendingReview = { cardId: string; rating: Rating; durationMs: number };

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

const CardStateBadge: Record<
	CardStateType,
	{ label: string; className: string }
> = {
	0: { label: "New", className: "bg-info/10 text-info" },
	1: { label: "Learning", className: "bg-warning/10 text-warning" },
	2: { label: "Review", className: "bg-success/10 text-success" },
	3: { label: "Relearning", className: "bg-error/10 text-error" },
};

function StudySession({
	deckId,
	onNavigate,
}: {
	deckId: string;
	onNavigate: (href: string) => void;
}) {
	const {
		data: { deck, cards },
	} = useAtomValue(studyDataAtomFamily(deckId));

	// Session state (kept as useState - transient UI state)
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isFlipped, setIsFlipped] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [completedCount, setCompletedCount] = useState(0);
	const cardStartTimeRef = useRef<number>(Date.now());
	const [pendingReview, setPendingReview] = useState<PendingReview | null>(
		null,
	);
	const pendingReviewRef = useRef<PendingReview | null>(null);
	const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

	// Keep ref in sync with state for cleanup effect
	useEffect(() => {
		pendingReviewRef.current = pendingReview;
	}, [pendingReview]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Reset timer when card changes
	useEffect(() => {
		cardStartTimeRef.current = Date.now();
	}, [currentIndex]);

	const handleFlip = useCallback(() => {
		setIsFlipped(true);
	}, []);

	const flushPendingReview = useCallback(
		async (review: PendingReview) => {
			const res = await apiClient.rpc.api.decks[":deckId"].study[
				":cardId"
			].$post({
				param: { deckId, cardId: review.cardId },
				json: { rating: review.rating, durationMs: review.durationMs },
			});
			await apiClient.handleResponse(res);
		},
		[deckId],
	);

	const handleRating = useCallback(
		async (rating: Rating) => {
			if (isSubmitting) return;

			const currentCard = cards[currentIndex];
			if (!currentCard) return;

			setIsSubmitting(true);
			setSubmitError(null);

			const durationMs = Date.now() - cardStartTimeRef.current;

			// Flush previous pending review first
			if (pendingReview) {
				try {
					await flushPendingReview(pendingReview);
				} catch (err) {
					if (err instanceof ApiClientError) {
						setSubmitError(err.message);
					} else {
						setSubmitError("Failed to submit review. Please try again.");
					}
				}
			}

			// Save current review as pending (don't send yet)
			setPendingReview({ cardId: currentCard.id, rating, durationMs });
			setCompletedCount((prev) => prev + 1);
			setIsFlipped(false);
			setCurrentIndex((prev) => prev + 1);
			setIsSubmitting(false);
		},
		[isSubmitting, cards, currentIndex, pendingReview, flushPendingReview],
	);

	const handleUndo = useCallback(() => {
		if (!pendingReview) return;
		setPendingReview(null);
		setCurrentIndex((prev) => prev - 1);
		setCompletedCount((prev) => prev - 1);
		setIsFlipped(false);
	}, [pendingReview]);

	const [isNavigating, setIsNavigating] = useState(false);

	const handleNavigateAway = useCallback(
		async (href: string) => {
			if (isNavigating) return;
			setIsNavigating(true);
			const review = pendingReviewRef.current;
			if (review) {
				try {
					await flushPendingReview(review);
					setPendingReview(null);
				} catch {
					// Continue navigation even on error
				}
			}
			await queryClient.invalidateQueries({ queryKey: ["decks"] });
			onNavigate(href);
		},
		[isNavigating, flushPendingReview, onNavigate],
	);

	// Flush pending review on unmount (fire-and-forget)
	useEffect(() => {
		return () => {
			const review = pendingReviewRef.current;
			if (review) {
				apiClient.rpc.api.decks[":deckId"].study[":cardId"]
					.$post({
						param: { deckId, cardId: review.cardId },
						json: { rating: review.rating, durationMs: review.durationMs },
					})
					.then((res) => apiClient.handleResponse(res))
					.then(() => queryClient.invalidateQueries({ queryKey: ["decks"] }))
					.catch(() => {});
			} else {
				queryClient.invalidateQueries({ queryKey: ["decks"] });
			}
		};
	}, [deckId]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (isSubmitting) return;
			if (editingNoteId) return;

			// Edit: E key to open edit modal
			if (e.key === "e" && cards[currentIndex]) {
				e.preventDefault();
				setEditingNoteId(cards[currentIndex].noteId);
				return;
			}

			// Undo: Ctrl+Z / Cmd+Z anytime, or z when card is not flipped
			if (
				(e.key === "z" && (e.ctrlKey || e.metaKey)) ||
				(e.key === "z" && !e.ctrlKey && !e.metaKey && !isFlipped)
			) {
				e.preventDefault();
				handleUndo();
				return;
			}

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
					" ": 3,
				};

				const rating = keyRatingMap[e.key];
				if (rating) {
					e.preventDefault();
					handleRating(rating);
				}
			}
		},
		[
			isFlipped,
			isSubmitting,
			editingNoteId,
			cards,
			currentIndex,
			handleFlip,
			handleRating,
			handleUndo,
		],
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	const currentCard = cards[currentIndex];
	const isSessionComplete = currentIndex >= cards.length && cards.length > 0;
	const hasNoCards = cards.length === 0;
	const remainingCards = cards.length - currentIndex;

	const cardContent = useMemo(() => {
		if (!currentCard) return null;

		return renderCard({
			frontTemplate: currentCard.noteType.frontTemplate,
			backTemplate: currentCard.noteType.backTemplate,
			fieldValues: currentCard.fieldValuesMap,
			isReversed: currentCard.isReversed ?? false,
		});
	}, [currentCard]);

	return (
		<div className="flex-1 flex flex-col animate-fade-in">
			{/* Submit Error */}
			{submitError && (
				<div
					role="alert"
					className="bg-error/5 border border-error/20 rounded-xl p-4 flex items-center justify-between mb-4"
				>
					<span className="text-error">{submitError}</span>
					<button
						type="button"
						onClick={() => setSubmitError(null)}
						className="text-error hover:text-error/80 font-medium text-sm"
					>
						Dismiss
					</button>
				</div>
			)}

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

			{/* Undo Button */}
			{pendingReview && !isFlipped && !isSessionComplete && (
				<div className="flex justify-end mb-4">
					<button
						type="button"
						data-testid="undo-button"
						onClick={handleUndo}
						className="inline-flex items-center gap-1.5 text-muted hover:text-slate text-sm transition-colors"
					>
						<FontAwesomeIcon
							icon={faRotateLeft}
							className="w-3.5 h-3.5"
							aria-hidden="true"
						/>
						Undo
						<kbd className="ml-1 px-1.5 py-0.5 bg-ivory rounded text-xs font-mono">
							Z
						</kbd>
					</button>
				</div>
			)}

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
							{pendingReview && (
								<button
									type="button"
									data-testid="undo-button"
									onClick={handleUndo}
									className="inline-flex items-center justify-center gap-2 bg-ivory hover:bg-border text-slate font-medium py-2.5 px-5 rounded-lg transition-all duration-200"
								>
									<FontAwesomeIcon
										icon={faRotateLeft}
										className="w-4 h-4"
										aria-hidden="true"
									/>
									Undo
								</button>
							)}
							<button
								type="button"
								disabled={isNavigating}
								onClick={() => handleNavigateAway(`/decks/${deckId}`)}
								className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-5 rounded-lg transition-all duration-200 disabled:opacity-50"
							>
								Back to Deck
							</button>
							<button
								type="button"
								disabled={isNavigating}
								onClick={() => handleNavigateAway("/")}
								className="inline-flex items-center justify-center gap-2 bg-ivory hover:bg-border text-slate font-medium py-2.5 px-5 rounded-lg transition-all duration-200 disabled:opacity-50"
							>
								All Decks
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Active Study Card */}
			{currentCard && cardContent && !isSessionComplete && (
				<div data-testid="study-card" className="flex-1 flex flex-col">
					{/* Card */}
					<button
						type="button"
						data-testid="card-container"
						onClick={!isFlipped ? handleFlip : undefined}
						aria-label={
							isFlipped ? "Card showing answer" : "Click to reveal answer"
						}
						className={`relative flex-1 min-h-[280px] bg-white rounded-2xl border border-border/50 shadow-card p-8 flex flex-col items-center justify-center text-center transition-all duration-300 ${
							!isFlipped
								? "cursor-pointer hover:shadow-lg hover:border-primary/30 active:scale-[0.99]"
								: "bg-ivory/50"
						}`}
					>
						{/* Edit button */}
						{/* biome-ignore lint/a11y/useSemanticElements: Cannot nest <button> inside parent <button>, using span with role="button" instead */}
						<span
							role="button"
							tabIndex={0}
							data-testid="edit-card-button"
							onClick={(e) => {
								e.stopPropagation();
								setEditingNoteId(currentCard.noteId);
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.stopPropagation();
									e.preventDefault();
									setEditingNoteId(currentCard.noteId);
								}
							}}
							className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-muted hover:text-slate transition-colors rounded-lg hover:bg-ivory"
							aria-label="Edit card"
						>
							<FontAwesomeIcon
								icon={faPen}
								className="w-3.5 h-3.5"
								aria-hidden="true"
							/>
						</span>
						{/* Card state badge */}
						<span
							data-testid="card-state-badge"
							className={`absolute top-3 left-3 text-xs font-medium px-2 py-0.5 rounded-full ${CardStateBadge[currentCard.state].className}`}
						>
							{CardStateBadge[currentCard.state].label}
						</span>
						{!isFlipped ? (
							<>
								<p
									data-testid="card-front"
									className="text-xl md:text-2xl text-ink font-medium whitespace-pre-wrap break-words leading-relaxed"
								>
									{cardContent.front}
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
								{cardContent.back}
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

			{/* Edit Note Modal */}
			<EditNoteModal
				isOpen={!!editingNoteId}
				deckId={deckId}
				noteId={editingNoteId}
				onClose={() => setEditingNoteId(null)}
				onNoteUpdated={() => setEditingNoteId(null)}
			/>
		</div>
	);
}

export function StudyPage() {
	const { deckId } = useParams<{ deckId: string }>();
	const [, navigate] = useLocation();

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
				<ErrorBoundary>
					<Suspense
						fallback={
							<div className="flex-1 flex flex-col">
								<div className="flex items-center justify-between mb-6">
									<div className="h-7 w-36 bg-muted/20 rounded animate-pulse" />
									<div className="h-7 w-24 bg-muted/20 rounded-full animate-pulse" />
								</div>
								<div className="flex-1 min-h-[280px] bg-white rounded-2xl border border-border/50 shadow-card p-8 flex items-center justify-center">
									<div className="h-7 w-48 bg-muted/20 rounded animate-pulse" />
								</div>
							</div>
						}
					>
						<StudySession deckId={deckId} onNavigate={navigate} />
					</Suspense>
				</ErrorBoundary>
			</main>
		</div>
	);
}
