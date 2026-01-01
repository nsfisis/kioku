import {
	faChevronLeft,
	faCirclePlay,
	faFile,
	faFileImport,
	faLayerGroup,
	faPen,
	faPlus,
	faSpinner,
	faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ApiClientError, apiClient } from "../api";
import { CreateNoteModal } from "../components/CreateNoteModal";
import { DeleteCardModal } from "../components/DeleteCardModal";
import { DeleteNoteModal } from "../components/DeleteNoteModal";
import { EditCardModal } from "../components/EditCardModal";
import { EditNoteModal } from "../components/EditNoteModal";
import { ImportNotesModal } from "../components/ImportNotesModal";

interface Card {
	id: string;
	deckId: string;
	noteId: string;
	isReversed: boolean;
	front: string;
	back: string;
	state: number;
	due: string;
	reps: number;
	lapses: number;
	createdAt: string;
	updatedAt: string;
}

/** Combined type for display: note group */
type CardDisplayItem = { type: "note"; noteId: string; cards: Card[] };

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

/** Component for displaying a group of cards from the same note */
function NoteGroupCard({
	noteId,
	cards,
	index,
	onEditNote,
	onDeleteNote,
}: {
	noteId: string;
	cards: Card[];
	index: number;
	onEditNote: () => void;
	onDeleteNote: () => void;
}) {
	// Use the first card's front/back as preview (normal card takes precedence)
	const previewCard = cards.find((c) => !c.isReversed) ?? cards[0];
	if (!previewCard) return null;

	return (
		<div
			data-testid="note-group"
			data-note-id={noteId}
			className="bg-white rounded-xl border border-border/50 shadow-card hover:shadow-md transition-all duration-200 overflow-hidden"
			style={{ animationDelay: `${index * 30}ms` }}
		>
			{/* Note Header */}
			<div className="flex items-center justify-between px-5 py-3 border-b border-border/30 bg-ivory/30">
				<div className="flex items-center gap-2">
					<FontAwesomeIcon
						icon={faLayerGroup}
						className="w-4 h-4 text-muted"
						aria-hidden="true"
					/>
					<span className="text-sm font-medium text-slate">
						Note ({cards.length} card{cards.length !== 1 ? "s" : ""})
					</span>
				</div>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={onEditNote}
						className="p-2 text-muted hover:text-slate hover:bg-white rounded-lg transition-colors"
						title="Edit note"
					>
						<FontAwesomeIcon
							icon={faPen}
							className="w-4 h-4"
							aria-hidden="true"
						/>
					</button>
					<button
						type="button"
						onClick={onDeleteNote}
						className="p-2 text-muted hover:text-error hover:bg-error/5 rounded-lg transition-colors"
						title="Delete note"
					>
						<FontAwesomeIcon
							icon={faTrash}
							className="w-4 h-4"
							aria-hidden="true"
						/>
					</button>
				</div>
			</div>

			{/* Note Content Preview */}
			<div className="p-5">
				<div className="grid grid-cols-2 gap-4 mb-4">
					<div>
						<span className="text-xs font-medium text-muted uppercase tracking-wide">
							Front
						</span>
						<p className="mt-1 text-slate text-sm line-clamp-2 whitespace-pre-wrap break-words">
							{previewCard.front}
						</p>
					</div>
					<div>
						<span className="text-xs font-medium text-muted uppercase tracking-wide">
							Back
						</span>
						<p className="mt-1 text-slate text-sm line-clamp-2 whitespace-pre-wrap break-words">
							{previewCard.back}
						</p>
					</div>
				</div>

				{/* Cards within this note */}
				<div className="space-y-2">
					{cards.map((card) => (
						<div
							key={card.id}
							data-testid="note-card"
							className="flex items-center gap-3 text-xs p-2 bg-ivory/50 rounded-lg"
						>
							<span
								className={`px-2 py-0.5 rounded-full font-medium ${CardStateColors[card.state] || "bg-muted/10 text-muted"}`}
							>
								{CardStateLabels[card.state] || "Unknown"}
							</span>
							{card.isReversed ? (
								<span className="px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
									Reversed
								</span>
							) : (
								<span className="px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
									Normal
								</span>
							)}
							<span className="text-muted">{card.reps} reviews</span>
							{card.lapses > 0 && (
								<span className="text-muted">{card.lapses} lapses</span>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

export function DeckDetailPage() {
	const { deckId } = useParams<{ deckId: string }>();
	const [deck, setDeck] = useState<Deck | null>(null);
	const [cards, setCards] = useState<Card[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [isImportModalOpen, setIsImportModalOpen] = useState(false);
	const [editingCard, setEditingCard] = useState<Card | null>(null);
	const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
	const [deletingCard, setDeletingCard] = useState<Card | null>(null);
	const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

	// Group cards by note for display
	const displayItems = useMemo((): CardDisplayItem[] => {
		const noteGroups = new Map<string, Card[]>();

		for (const card of cards) {
			const existing = noteGroups.get(card.noteId);
			if (existing) {
				existing.push(card);
			} else {
				noteGroups.set(card.noteId, [card]);
			}
		}

		// Sort note groups by earliest card creation (newest first)
		const sortedNoteGroups = Array.from(noteGroups.entries()).sort(
			([, cardsA], [, cardsB]) => {
				const minA = Math.min(
					...cardsA.map((c) => new Date(c.createdAt).getTime()),
				);
				const minB = Math.min(
					...cardsB.map((c) => new Date(c.createdAt).getTime()),
				);
				return minB - minA; // Newest first
			},
		);

		const items: CardDisplayItem[] = [];
		for (const [noteId, noteCards] of sortedNoteGroups) {
			// Sort cards within group: normal first, then reversed
			noteCards.sort((a, b) => {
				if (a.isReversed === b.isReversed) return 0;
				return a.isReversed ? 1 : -1;
			});
			items.push({ type: "note", noteId, cards: noteCards });
		}

		return items;
	}, [cards]);

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
						<FontAwesomeIcon
							icon={faChevronLeft}
							className="w-4 h-4"
							aria-hidden="true"
						/>
						Back to Decks
					</Link>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-4xl mx-auto px-4 py-8">
				{/* Loading State */}
				{isLoading && (
					<div className="flex items-center justify-center py-12">
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
								<FontAwesomeIcon
									icon={faCirclePlay}
									className="w-5 h-5"
									aria-hidden="true"
								/>
								Study Now
							</Link>
						</div>

						{/* Cards Section */}
						<div className="flex items-center justify-between mb-6">
							<h2 className="font-display text-xl font-medium text-slate">
								Cards{" "}
								<span className="text-muted font-normal">({cards.length})</span>
							</h2>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => setIsImportModalOpen(true)}
									className="inline-flex items-center gap-2 border border-border hover:bg-ivory text-slate font-medium py-2 px-4 rounded-lg transition-all duration-200 active:scale-[0.98]"
								>
									<FontAwesomeIcon
										icon={faFileImport}
										className="w-5 h-5"
										aria-hidden="true"
									/>
									Import CSV
								</button>
								<button
									type="button"
									onClick={() => setIsCreateModalOpen(true)}
									className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 active:scale-[0.98]"
								>
									<FontAwesomeIcon
										icon={faPlus}
										className="w-5 h-5"
										aria-hidden="true"
									/>
									Add Note
								</button>
							</div>
						</div>

						{/* Empty State */}
						{cards.length === 0 && (
							<div className="text-center py-12 bg-white rounded-xl border border-border/50">
								<div className="w-14 h-14 mx-auto mb-4 bg-ivory rounded-xl flex items-center justify-center">
									<FontAwesomeIcon
										icon={faFile}
										className="w-7 h-7 text-muted"
										aria-hidden="true"
									/>
								</div>
								<h3 className="font-display text-lg font-medium text-slate mb-2">
									No cards yet
								</h3>
								<p className="text-muted text-sm mb-4">
									Add notes to start studying
								</p>
								<button
									type="button"
									onClick={() => setIsCreateModalOpen(true)}
									className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2 px-4 rounded-lg transition-all duration-200"
								>
									<FontAwesomeIcon
										icon={faPlus}
										className="w-5 h-5"
										aria-hidden="true"
									/>
									Add Your First Note
								</button>
							</div>
						)}

						{/* Card List - Grouped by Note */}
						{cards.length > 0 && (
							<div className="space-y-4">
								{displayItems.map((item, index) => (
									<NoteGroupCard
										key={item.noteId}
										noteId={item.noteId}
										cards={item.cards}
										index={index}
										onEditNote={() => setEditingNoteId(item.noteId)}
										onDeleteNote={() => setDeletingNoteId(item.noteId)}
									/>
								))}
							</div>
						)}
					</div>
				)}
			</main>

			{/* Modals */}
			{deckId && (
				<CreateNoteModal
					isOpen={isCreateModalOpen}
					deckId={deckId}
					onClose={() => setIsCreateModalOpen(false)}
					onNoteCreated={fetchCards}
				/>
			)}

			{deckId && (
				<ImportNotesModal
					isOpen={isImportModalOpen}
					deckId={deckId}
					onClose={() => setIsImportModalOpen(false)}
					onImportComplete={fetchCards}
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
				<EditNoteModal
					isOpen={editingNoteId !== null}
					deckId={deckId}
					noteId={editingNoteId}
					onClose={() => setEditingNoteId(null)}
					onNoteUpdated={fetchCards}
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

			{deckId && (
				<DeleteNoteModal
					isOpen={deletingNoteId !== null}
					deckId={deckId}
					noteId={deletingNoteId}
					onClose={() => setDeletingNoteId(null)}
					onNoteDeleted={fetchCards}
				/>
			)}
		</div>
	);
}
