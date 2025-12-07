import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { ApiClientError, apiClient } from "../api";
import { CreateCardModal } from "../components/CreateCardModal";
import { DeleteCardModal } from "../components/DeleteCardModal";
import { EditCardModal } from "../components/EditCardModal";

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

const CardStateColors: Record<number, string> = {
	0: "bg-info/10 text-info",
	1: "bg-warning/10 text-warning",
	2: "bg-success/10 text-success",
	3: "bg-error/10 text-error",
};

export function DeckDetailPage() {
	const { deckId } = useParams<{ deckId: string }>();
	const [deck, setDeck] = useState<Deck | null>(null);
	const [cards, setCards] = useState<Card[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [editingCard, setEditingCard] = useState<Card | null>(null);
	const [deletingCard, setDeletingCard] = useState<Card | null>(null);

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
		<div className="min-h-screen bg-cream">
			{/* Header */}
			<header className="bg-white border-b border-border/50">
				<div className="max-w-4xl mx-auto px-4 py-4">
					<Link
						href="/"
						className="inline-flex items-center gap-2 text-muted hover:text-slate transition-colors text-sm"
					>
						<svg
							className="w-4 h-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M15 19l-7-7 7-7"
							/>
						</svg>
						Back to Decks
					</Link>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-4xl mx-auto px-4 py-8">
				{/* Loading State */}
				{isLoading && (
					<div className="flex items-center justify-center py-12">
						<svg
							className="animate-spin h-8 w-8 text-primary"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
								fill="none"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							/>
						</svg>
					</div>
				)}

				{/* Error State */}
				{error && (
					<div
						role="alert"
						className="bg-error/5 border border-error/20 rounded-xl p-4 flex items-center justify-between"
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

				{/* Deck Content */}
				{!isLoading && !error && deck && (
					<div className="animate-fade-in">
						{/* Deck Header */}
						<div className="mb-8">
							<h1 className="font-display text-3xl font-semibold text-ink mb-2">
								{deck.name}
							</h1>
							{deck.description && (
								<p className="text-muted">{deck.description}</p>
							)}
						</div>

						{/* Study Button */}
						<div className="mb-8">
							<Link
								href={`/decks/${deckId}/study`}
								className="inline-flex items-center gap-2 bg-success hover:bg-success/90 text-white font-medium py-3 px-6 rounded-xl transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow-md"
							>
								<svg
									className="w-5 h-5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
									/>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								Study Now
							</Link>
						</div>

						{/* Cards Section */}
						<div className="flex items-center justify-between mb-6">
							<h2 className="font-display text-xl font-medium text-slate">
								Cards{" "}
								<span className="text-muted font-normal">({cards.length})</span>
							</h2>
							<button
								type="button"
								onClick={() => setIsCreateModalOpen(true)}
								className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 active:scale-[0.98]"
							>
								<svg
									className="w-5 h-5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 4v16m8-8H4"
									/>
								</svg>
								Add Card
							</button>
						</div>

						{/* Empty State */}
						{cards.length === 0 && (
							<div className="text-center py-12 bg-white rounded-xl border border-border/50">
								<div className="w-14 h-14 mx-auto mb-4 bg-ivory rounded-xl flex items-center justify-center">
									<svg
										className="w-7 h-7 text-muted"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										aria-hidden="true"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={1.5}
											d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
										/>
									</svg>
								</div>
								<h3 className="font-display text-lg font-medium text-slate mb-2">
									No cards yet
								</h3>
								<p className="text-muted text-sm mb-4">
									Add cards to start studying
								</p>
								<button
									type="button"
									onClick={() => setIsCreateModalOpen(true)}
									className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2 px-4 rounded-lg transition-all duration-200"
								>
									<svg
										className="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										aria-hidden="true"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 4v16m8-8H4"
										/>
									</svg>
									Add Your First Card
								</button>
							</div>
						)}

						{/* Card List */}
						{cards.length > 0 && (
							<div className="space-y-3">
								{cards.map((card, index) => (
									<div
										key={card.id}
										className="bg-white rounded-xl border border-border/50 p-5 shadow-card hover:shadow-md transition-all duration-200"
										style={{ animationDelay: `${index * 30}ms` }}
									>
										<div className="flex items-start justify-between gap-4">
											<div className="flex-1 min-w-0">
												{/* Front/Back Preview */}
												<div className="grid grid-cols-2 gap-4 mb-3">
													<div>
														<span className="text-xs font-medium text-muted uppercase tracking-wide">
															Front
														</span>
														<p className="mt-1 text-slate text-sm line-clamp-2 whitespace-pre-wrap break-words">
															{card.front}
														</p>
													</div>
													<div>
														<span className="text-xs font-medium text-muted uppercase tracking-wide">
															Back
														</span>
														<p className="mt-1 text-slate text-sm line-clamp-2 whitespace-pre-wrap break-words">
															{card.back}
														</p>
													</div>
												</div>

												{/* Card Stats */}
												<div className="flex items-center gap-3 text-xs">
													<span
														className={`px-2 py-0.5 rounded-full font-medium ${CardStateColors[card.state] || "bg-muted/10 text-muted"}`}
													>
														{CardStateLabels[card.state] || "Unknown"}
													</span>
													<span className="text-muted">
														{card.reps} reviews
													</span>
													{card.lapses > 0 && (
														<span className="text-muted">
															{card.lapses} lapses
														</span>
													)}
												</div>
											</div>

											{/* Actions */}
											<div className="flex items-center gap-1 shrink-0">
												<button
													type="button"
													onClick={() => setEditingCard(card)}
													className="p-2 text-muted hover:text-slate hover:bg-ivory rounded-lg transition-colors"
													title="Edit card"
												>
													<svg
														className="w-4 h-4"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
														aria-hidden="true"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
														/>
													</svg>
												</button>
												<button
													type="button"
													onClick={() => setDeletingCard(card)}
													className="p-2 text-muted hover:text-error hover:bg-error/5 rounded-lg transition-colors"
													title="Delete card"
												>
													<svg
														className="w-4 h-4"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
														aria-hidden="true"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
														/>
													</svg>
												</button>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				)}
			</main>

			{/* Modals */}
			{deckId && (
				<CreateCardModal
					isOpen={isCreateModalOpen}
					deckId={deckId}
					onClose={() => setIsCreateModalOpen(false)}
					onCardCreated={fetchCards}
				/>
			)}

			{deckId && (
				<EditCardModal
					isOpen={editingCard !== null}
					deckId={deckId}
					card={editingCard}
					onClose={() => setEditingCard(null)}
					onCardUpdated={fetchCards}
				/>
			)}

			{deckId && (
				<DeleteCardModal
					isOpen={deletingCard !== null}
					deckId={deckId}
					card={deletingCard}
					onClose={() => setDeletingCard(null)}
					onCardDeleted={fetchCards}
				/>
			)}
		</div>
	);
}
