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

const RatingColors: Record<Rating, string> = {
	1: "#dc3545",
	2: "#fd7e14",
	3: "#28a745",
	4: "#007bff",
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

	useEffect(() => {
		cardStartTimeRef.current = Date.now();
	}, [currentIndex]);

	const handleFlip = () => {
		setIsFlipped(true);
	};

	const handleRating = async (rating: Rating) => {
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
	};

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
		[isFlipped, isSubmitting],
	);

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleKeyDown]);

	if (!deckId) {
		return (
			<div>
				<p>Invalid deck ID</p>
				<Link href="/">Back to decks</Link>
			</div>
		);
	}

	const currentCard = cards[currentIndex];
	const isSessionComplete = currentIndex >= cards.length && cards.length > 0;
	const hasNoCards = !isLoading && cards.length === 0;
	const remainingCards = cards.length - currentIndex;

	return (
		<div style={{ maxWidth: "600px", margin: "0 auto", padding: "1rem" }}>
			<header style={{ marginBottom: "1rem" }}>
				<Link href={`/decks/${deckId}`} style={{ textDecoration: "none" }}>
					&larr; Back to Deck
				</Link>
			</header>

			{isLoading && <p>Loading study session...</p>}

			{error && (
				<div role="alert" style={{ color: "red", marginBottom: "1rem" }}>
					{error}
					<button
						type="button"
						onClick={fetchData}
						style={{ marginLeft: "0.5rem" }}
					>
						Retry
					</button>
				</div>
			)}

			{!isLoading && !error && deck && (
				<>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: "1rem",
						}}
					>
						<h1 style={{ margin: 0 }}>Study: {deck.name}</h1>
						{!isSessionComplete && !hasNoCards && (
							<span
								data-testid="remaining-count"
								style={{
									backgroundColor: "#f0f0f0",
									padding: "0.25rem 0.75rem",
									borderRadius: "12px",
									fontSize: "0.875rem",
								}}
							>
								{remainingCards} remaining
							</span>
						)}
					</div>

					{hasNoCards && (
						<div
							data-testid="no-cards"
							style={{
								textAlign: "center",
								padding: "3rem 1rem",
								backgroundColor: "#f8f9fa",
								borderRadius: "8px",
							}}
						>
							<h2 style={{ marginTop: 0 }}>No cards to study</h2>
							<p style={{ color: "#666" }}>
								There are no due cards in this deck right now.
							</p>
							<Link href={`/decks/${deckId}`}>
								<button type="button">Back to Deck</button>
							</Link>
						</div>
					)}

					{isSessionComplete && (
						<div
							data-testid="session-complete"
							style={{
								textAlign: "center",
								padding: "3rem 1rem",
								backgroundColor: "#d4edda",
								borderRadius: "8px",
							}}
						>
							<h2 style={{ marginTop: 0, color: "#155724" }}>
								Session Complete!
							</h2>
							<p style={{ fontSize: "1.25rem", marginBottom: "1.5rem" }}>
								You reviewed{" "}
								<strong data-testid="completed-count">{completedCount}</strong>{" "}
								card{completedCount !== 1 ? "s" : ""}.
							</p>
							<div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
								<Link href={`/decks/${deckId}`}>
									<button type="button">Back to Deck</button>
								</Link>
								<Link href="/">
									<button type="button">All Decks</button>
								</Link>
							</div>
						</div>
					)}

					{currentCard && !isSessionComplete && (
						<div data-testid="study-card">
							<div
								data-testid="card-container"
								onClick={!isFlipped ? handleFlip : undefined}
								onKeyDown={(e) => {
									if (!isFlipped && (e.key === " " || e.key === "Enter")) {
										e.preventDefault();
										handleFlip();
									}
								}}
								role="button"
								tabIndex={0}
								aria-label={isFlipped ? "Card showing answer" : "Click to reveal answer"}
								style={{
									border: "1px solid #ccc",
									borderRadius: "8px",
									padding: "2rem",
									minHeight: "200px",
									display: "flex",
									flexDirection: "column",
									justifyContent: "center",
									alignItems: "center",
									cursor: isFlipped ? "default" : "pointer",
									backgroundColor: isFlipped ? "#f8f9fa" : "white",
									transition: "background-color 0.2s",
								}}
							>
								{!isFlipped ? (
									<>
										<p
											data-testid="card-front"
											style={{
												fontSize: "1.25rem",
												textAlign: "center",
												margin: 0,
												whiteSpace: "pre-wrap",
												wordBreak: "break-word",
											}}
										>
											{currentCard.front}
										</p>
										<p
											style={{
												marginTop: "1.5rem",
												color: "#666",
												fontSize: "0.875rem",
											}}
										>
											Click or press Space to reveal
										</p>
									</>
								) : (
									<>
										<p
											data-testid="card-back"
											style={{
												fontSize: "1.25rem",
												textAlign: "center",
												margin: 0,
												whiteSpace: "pre-wrap",
												wordBreak: "break-word",
											}}
										>
											{currentCard.back}
										</p>
									</>
								)}
							</div>

							{isFlipped && (
								<div
									data-testid="rating-buttons"
									style={{
										display: "flex",
										gap: "0.5rem",
										justifyContent: "center",
										marginTop: "1rem",
									}}
								>
									{([1, 2, 3, 4] as Rating[]).map((rating) => (
										<button
											key={rating}
											type="button"
											data-testid={`rating-${rating}`}
											onClick={() => handleRating(rating)}
											disabled={isSubmitting}
											style={{
												flex: 1,
												padding: "0.75rem 1rem",
												backgroundColor: RatingColors[rating],
												color: "white",
												border: "none",
												borderRadius: "4px",
												cursor: isSubmitting ? "not-allowed" : "pointer",
												opacity: isSubmitting ? 0.6 : 1,
												fontSize: "0.875rem",
											}}
										>
											<span style={{ display: "block", fontWeight: "bold" }}>
												{RatingLabels[rating]}
											</span>
											<span style={{ display: "block", fontSize: "0.75rem" }}>
												{rating}
											</span>
										</button>
									))}
								</div>
							)}
						</div>
					)}
				</>
			)}
		</div>
	);
}
