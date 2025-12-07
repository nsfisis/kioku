import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ApiClientError, apiClient } from "../api";
import { CreateDeckModal } from "../components/CreateDeckModal";
import { DeleteDeckModal } from "../components/DeleteDeckModal";
import { EditDeckModal } from "../components/EditDeckModal";
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
		<div>
			<header
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "1rem",
				}}
			>
				<h1>Kioku</h1>
				<button type="button" onClick={logout}>
					Logout
				</button>
			</header>

			<main>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: "1rem",
					}}
				>
					<h2 style={{ margin: 0 }}>Your Decks</h2>
					<button type="button" onClick={() => setIsCreateModalOpen(true)}>
						Create Deck
					</button>
				</div>

				{isLoading && <p>Loading decks...</p>}

				{error && (
					<div role="alert" style={{ color: "red" }}>
						{error}
						<button
							type="button"
							onClick={fetchDecks}
							style={{ marginLeft: "0.5rem" }}
						>
							Retry
						</button>
					</div>
				)}

				{!isLoading && !error && decks.length === 0 && (
					<div>
						<p>You don't have any decks yet.</p>
						<p>Create your first deck to start learning!</p>
					</div>
				)}

				{!isLoading && !error && decks.length > 0 && (
					<ul style={{ listStyle: "none", padding: 0 }}>
						{decks.map((deck) => (
							<li
								key={deck.id}
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
									<div>
										<h3 style={{ margin: 0 }}>
											<Link
												href={`/decks/${deck.id}`}
												style={{ textDecoration: "none", color: "inherit" }}
											>
												{deck.name}
											</Link>
										</h3>
										{deck.description && (
											<p style={{ margin: "0.5rem 0 0 0", color: "#666" }}>
												{deck.description}
											</p>
										)}
									</div>
									<div style={{ display: "flex", gap: "0.5rem" }}>
										<button type="button" onClick={() => setEditingDeck(deck)}>
											Edit
										</button>
										<button
											type="button"
											onClick={() => setDeletingDeck(deck)}
											style={{
												backgroundColor: "#dc3545",
												color: "white",
												border: "none",
												padding: "0.25rem 0.5rem",
												borderRadius: "4px",
												cursor: "pointer",
											}}
										>
											Delete
										</button>
									</div>
								</div>
							</li>
						))}
					</ul>
				)}
			</main>

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
