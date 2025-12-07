import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ApiClientError, apiClient } from "../api";
import { CreateDeckModal } from "../components/CreateDeckModal";
import { DeleteDeckModal } from "../components/DeleteDeckModal";
import { EditDeckModal } from "../components/EditDeckModal";
import { SyncButton } from "../components/SyncButton";
import { SyncStatusIndicator } from "../components/SyncStatusIndicator";
import { useAuth } from "../stores";

interface Deck {
	id: string;
	name: string;
	description: string | null;
	newCardsPerDay: number;
	createdAt: string;
	updatedAt: string;
}

export function HomePage() {
	const { logout } = useAuth();
	const [decks, setDecks] = useState<Deck[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
	const [deletingDeck, setDeletingDeck] = useState<Deck | null>(null);

	const fetchDecks = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const res = await apiClient.rpc.api.decks.$get(undefined, {
				headers: apiClient.getAuthHeader(),
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
			setDecks(data.decks);
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to load decks. Please try again.");
			}
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchDecks();
	}, [fetchDecks]);

	return (
		<div className="min-h-screen bg-cream">
			{/* Header */}
			<header className="bg-white border-b border-border/50 sticky top-0 z-10">
				<div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
					<h1 className="font-display text-2xl font-semibold text-ink">
						Kioku
					</h1>
					<div className="flex items-center gap-3">
						<SyncStatusIndicator />
						<SyncButton />
						<button
							type="button"
							onClick={logout}
							className="text-sm text-muted hover:text-slate transition-colors px-3 py-1.5 rounded-lg hover:bg-ivory"
						>
							Logout
						</button>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-4xl mx-auto px-4 py-8">
				{/* Section Header */}
				<div className="flex items-center justify-between mb-6">
					<h2 className="font-display text-xl font-medium text-slate">
						Your Decks
					</h2>
					<button
						type="button"
						onClick={() => setIsCreateModalOpen(true)}
						className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow-md"
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
						New Deck
					</button>
				</div>

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
							onClick={fetchDecks}
							className="text-error hover:text-error/80 font-medium text-sm"
						>
							Retry
						</button>
					</div>
				)}

				{/* Empty State */}
				{!isLoading && !error && decks.length === 0 && (
					<div className="text-center py-16 animate-fade-in">
						<div className="w-16 h-16 mx-auto mb-4 bg-ivory rounded-2xl flex items-center justify-center">
							<svg
								className="w-8 h-8 text-muted"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={1.5}
									d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
								/>
							</svg>
						</div>
						<h3 className="font-display text-lg font-medium text-slate mb-2">
							No decks yet
						</h3>
						<p className="text-muted text-sm mb-6">
							Create your first deck to start learning
						</p>
						<button
							type="button"
							onClick={() => setIsCreateModalOpen(true)}
							className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 px-5 rounded-lg transition-all duration-200"
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
							Create Your First Deck
						</button>
					</div>
				)}

				{/* Deck List */}
				{!isLoading && !error && decks.length > 0 && (
					<div className="space-y-3 animate-fade-in">
						{decks.map((deck, index) => (
							<div
								key={deck.id}
								className="bg-white rounded-xl border border-border/50 p-5 shadow-card hover:shadow-md transition-all duration-200 group"
								style={{ animationDelay: `${index * 50}ms` }}
							>
								<div className="flex items-start justify-between gap-4">
									<div className="flex-1 min-w-0">
										<Link
											href={`/decks/${deck.id}`}
											className="block group-hover:text-primary transition-colors"
										>
											<h3 className="font-display text-lg font-medium text-slate truncate">
												{deck.name}
											</h3>
										</Link>
										{deck.description && (
											<p className="text-muted text-sm mt-1 line-clamp-2">
												{deck.description}
											</p>
										)}
									</div>
									<div className="flex items-center gap-2 shrink-0">
										<button
											type="button"
											onClick={() => setEditingDeck(deck)}
											className="p-2 text-muted hover:text-slate hover:bg-ivory rounded-lg transition-colors"
											title="Edit deck"
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
											onClick={() => setDeletingDeck(deck)}
											className="p-2 text-muted hover:text-error hover:bg-error/5 rounded-lg transition-colors"
											title="Delete deck"
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
			</main>

			{/* Modals */}
			<CreateDeckModal
				isOpen={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
				onDeckCreated={fetchDecks}
			/>

			<EditDeckModal
				isOpen={editingDeck !== null}
				deck={editingDeck}
				onClose={() => setEditingDeck(null)}
				onDeckUpdated={fetchDecks}
			/>

			<DeleteDeckModal
				isOpen={deletingDeck !== null}
				deck={deletingDeck}
				onClose={() => setDeletingDeck(null)}
				onDeckDeleted={fetchDecks}
			/>
		</div>
	);
}
