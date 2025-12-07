import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { ApiClientError, apiClient } from "../api";
import { CreateCardModal } from "../components/CreateCardModal";

interface Card {
	id: string;
	deckId: string;
	front: string;
	back: string;
	state: number;
	due: string;
	reps: number;
	lapses: number;
	createdAt: string;
	updatedAt: string;
}

interface Deck {
	id: string;
	name: string;
	description: string | null;
}

const CardStateLabels: Record<number, string> = {
	0: "New",
	1: "Learning",
	2: "Review",
	3: "Relearning",
};

export function DeckDetailPage() {
	const { deckId } = useParams<{ deckId: string }>();
	const [deck, setDeck] = useState<Deck | null>(null);
	const [cards, setCards] = useState<Card[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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

	const fetchCards = useCallback(async () => {
		if (!deckId) return;

		const authHeader = apiClient.getAuthHeader();
		if (!authHeader) {
			throw new ApiClientError("Not authenticated", 401);
		}

		const res = await fetch(`/api/decks/${deckId}/cards`, {
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
			await Promise.all([fetchDeck(), fetchCards()]);
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to load data. Please try again.");
			}
		} finally {
			setIsLoading(false);
		}
	}, [fetchDeck, fetchCards]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	if (!deckId) {
		return (
			<div>
				<p>Invalid deck ID</p>
				<Link href="/">Back to decks</Link>
			</div>
		);
	}

	return (
		<div>
			<header style={{ marginBottom: "1rem" }}>
				<Link href="/" style={{ textDecoration: "none" }}>
					&larr; Back to Decks
				</Link>
			</header>

			{isLoading && <p>Loading...</p>}

			{error && (
				<div role="alert" style={{ color: "red" }}>
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
				<main>
					<div style={{ marginBottom: "1.5rem" }}>
						<h1 style={{ margin: 0 }}>{deck.name}</h1>
						{deck.description && (
							<p style={{ margin: "0.5rem 0 0 0", color: "#666" }}>
								{deck.description}
							</p>
						)}
					</div>

					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: "1rem",
						}}
					>
						<h2 style={{ margin: 0 }}>Cards ({cards.length})</h2>
						<button type="button" onClick={() => setIsCreateModalOpen(true)}>
							Add Card
						</button>
					</div>

					{cards.length === 0 && (
						<div>
							<p>This deck has no cards yet.</p>
							<p>Add cards to start studying!</p>
						</div>
					)}

					{cards.length > 0 && (
						<ul style={{ listStyle: "none", padding: 0 }}>
							{cards.map((card) => (
								<li
									key={card.id}
									style={{
										border: "1px solid #ccc",
										padding: "1rem",
										marginBottom: "0.5rem",
										borderRadius: "4px",
									}}
								>
									<div
										style={{
											display: "flex",
											justifyContent: "space-between",
											alignItems: "flex-start",
										}}
									>
										<div style={{ flex: 1, minWidth: 0 }}>
											<div
												style={{
													display: "flex",
													gap: "1rem",
													marginBottom: "0.5rem",
												}}
											>
												<div style={{ flex: 1, minWidth: 0 }}>
													<strong>Front:</strong>
													<p
														style={{
															margin: "0.25rem 0 0 0",
															whiteSpace: "pre-wrap",
															wordBreak: "break-word",
														}}
													>
														{card.front}
													</p>
												</div>
												<div style={{ flex: 1, minWidth: 0 }}>
													<strong>Back:</strong>
													<p
														style={{
															margin: "0.25rem 0 0 0",
															whiteSpace: "pre-wrap",
															wordBreak: "break-word",
														}}
													>
														{card.back}
													</p>
												</div>
											</div>
											<div
												style={{
													display: "flex",
													gap: "1rem",
													fontSize: "0.875rem",
													color: "#666",
												}}
											>
												<span>
													State: {CardStateLabels[card.state] || "Unknown"}
												</span>
												<span>Reviews: {card.reps}</span>
												<span>Lapses: {card.lapses}</span>
											</div>
										</div>
									</div>
								</li>
							))}
						</ul>
					)}
				</main>
			)}

			{deckId && (
				<CreateCardModal
					isOpen={isCreateModalOpen}
					deckId={deckId}
					onClose={() => setIsCreateModalOpen(false)}
					onCardCreated={fetchCards}
				/>
			)}
		</div>
	);
}
