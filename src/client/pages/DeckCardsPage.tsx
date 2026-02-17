import {
	faChevronLeft,
	faChevronRight,
	faFile,
	faFileImport,
	faLayerGroup,
	faMagnifyingGlass,
	faPen,
	faPlus,
	faTrash,
	faXmark,
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
import { useDebouncedCallback } from "use-debounce";
import { Link, useParams } from "wouter";
import { type Card, cardsByDeckAtomFamily, deckByIdAtomFamily } from "../atoms";
import { CreateNoteModal } from "../components/CreateNoteModal";
import { DeleteCardModal } from "../components/DeleteCardModal";
import { DeleteNoteModal } from "../components/DeleteNoteModal";
import { EditCardModal } from "../components/EditCardModal";
import { EditNoteModal } from "../components/EditNoteModal";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ImportNotesModal } from "../components/ImportNotesModal";
import type { CardStateType } from "../db";
import { queryClient } from "../queryClient";

/** Combined type for display: note group */
type CardDisplayItem = { type: "note"; noteId: string; cards: Card[] };

const CARDS_PER_PAGE = 50;

const CardStateLabels: Record<CardStateType, string> = {
	0: "New",
	1: "Learning",
	2: "Review",
	3: "Relearning",
};

const CardStateColors: Record<CardStateType, string> = {
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
					<span className="text-sm font-medium text-slate">Note</span>
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
							{card.difficulty > 0 && (
								<span className="text-muted">
									D: {card.difficulty.toFixed(1)}
								</span>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function DeckHeader({ deckId }: { deckId: string }) {
	const { data: deck } = useAtomValue(deckByIdAtomFamily(deckId));

	return (
		<div className="mb-8">
			<h1 className="font-display text-3xl font-semibold text-ink mb-2">
				{deck.name}
			</h1>
			{deck.description && <p className="text-muted">{deck.description}</p>}
		</div>
	);
}

/** Paginate note groups so each page contains at most CARDS_PER_PAGE cards */
function paginateNoteGroups(items: CardDisplayItem[]): CardDisplayItem[][] {
	const pages: CardDisplayItem[][] = [];
	let currentPage: CardDisplayItem[] = [];
	let currentCount = 0;

	for (const item of items) {
		if (currentCount > 0 && currentCount + item.cards.length > CARDS_PER_PAGE) {
			pages.push(currentPage);
			currentPage = [];
			currentCount = 0;
		}
		currentPage.push(item);
		currentCount += item.cards.length;
	}

	if (currentPage.length > 0) {
		pages.push(currentPage);
	}

	return pages;
}

function Pagination({
	currentPage,
	totalPages,
	onPageChange,
}: {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}) {
	if (totalPages <= 1) return null;

	return (
		<div className="flex items-center justify-center gap-2 mt-6">
			<button
				type="button"
				onClick={() => onPageChange(currentPage - 1)}
				disabled={currentPage === 0}
				className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-border hover:bg-ivory text-slate transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
			>
				<FontAwesomeIcon
					icon={faChevronLeft}
					className="w-3 h-3"
					aria-hidden="true"
				/>
				Prev
			</button>
			<span className="text-sm text-muted px-2">
				{currentPage + 1} / {totalPages}
			</span>
			<button
				type="button"
				onClick={() => onPageChange(currentPage + 1)}
				disabled={currentPage === totalPages - 1}
				className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-border hover:bg-ivory text-slate transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
			>
				Next
				<FontAwesomeIcon
					icon={faChevronRight}
					className="w-3 h-3"
					aria-hidden="true"
				/>
			</button>
		</div>
	);
}

function CardList({
	deckId,
	searchQuery,
	onEditNote,
	onDeleteNote,
	onCreateNote,
}: {
	deckId: string;
	searchQuery: string;
	onEditNote: (noteId: string) => void;
	onDeleteNote: (noteId: string) => void;
	onCreateNote: () => void;
}) {
	const { data: cards } = useAtomValue(cardsByDeckAtomFamily(deckId));
	const [currentPage, setCurrentPage] = useState(0);

	// Group cards by note for display, applying search filter
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

		const query = searchQuery.toLowerCase();
		const items: CardDisplayItem[] = [];
		for (const [noteId, noteCards] of sortedNoteGroups) {
			// Sort cards within group: normal first, then reversed
			noteCards.sort((a, b) => {
				if (a.isReversed === b.isReversed) return 0;
				return a.isReversed ? 1 : -1;
			});

			// Filter: if query is set, only include note groups where any card matches
			if (
				query &&
				!noteCards.some(
					(c) =>
						c.front.toLowerCase().includes(query) ||
						c.back.toLowerCase().includes(query),
				)
			) {
				continue;
			}

			items.push({ type: "note", noteId, cards: noteCards });
		}

		return items;
	}, [cards, searchQuery]);

	// Reset to first page when search query changes
	const prevSearchQuery = useRef(searchQuery);
	useEffect(() => {
		if (prevSearchQuery.current !== searchQuery) {
			prevSearchQuery.current = searchQuery;
			setCurrentPage(0);
		}
	}, [searchQuery]);

	const pages = useMemo(() => paginateNoteGroups(displayItems), [displayItems]);
	const totalPages = pages.length;

	// Clamp current page when data changes (e.g. after deletion)
	const safePage = totalPages > 0 ? Math.min(currentPage, totalPages - 1) : 0;
	if (safePage !== currentPage) {
		setCurrentPage(safePage);
	}

	const handlePageChange = useCallback((page: number) => {
		setCurrentPage(page);
		window.scrollTo({ top: 0, behavior: "smooth" });
	}, []);

	if (cards.length === 0) {
		return (
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
				<p className="text-muted text-sm mb-4">Add notes to start studying</p>
				<button
					type="button"
					onClick={onCreateNote}
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
		);
	}

	const pageItems = pages[safePage] ?? [];

	return (
		<div>
			<div className="space-y-4">
				{pageItems.map((item, index) => (
					<NoteGroupCard
						key={item.noteId}
						noteId={item.noteId}
						cards={item.cards}
						index={index}
						onEditNote={() => onEditNote(item.noteId)}
						onDeleteNote={() => onDeleteNote(item.noteId)}
					/>
				))}
			</div>
			<Pagination
				currentPage={safePage}
				totalPages={totalPages}
				onPageChange={handlePageChange}
			/>
		</div>
	);
}

function CardsContent({
	deckId,
	onCreateNote,
	onImportNotes,
	onEditNote,
	onDeleteNote,
}: {
	deckId: string;
	onCreateNote: () => void;
	onImportNotes: () => void;
	onEditNote: (noteId: string) => void;
	onDeleteNote: (noteId: string) => void;
}) {
	const { data: cards } = useAtomValue(cardsByDeckAtomFamily(deckId));
	const [searchInput, setSearchInput] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedSetQuery = useDebouncedCallback((value: string) => {
		setSearchQuery(value);
	}, 500);

	const handleSearchChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setSearchInput(value);
			debouncedSetQuery(value);
		},
		[debouncedSetQuery],
	);

	const handleClearSearch = useCallback(() => {
		setSearchInput("");
		setSearchQuery("");
		debouncedSetQuery.cancel();
	}, [debouncedSetQuery]);

	return (
		<div className="animate-fade-in">
			{/* Deck Header */}
			<ErrorBoundary>
				<Suspense
					fallback={
						<div className="mb-8">
							<div className="h-9 w-48 bg-muted/20 rounded animate-pulse mb-2" />
							<div className="h-5 w-64 bg-muted/20 rounded animate-pulse" />
						</div>
					}
				>
					<DeckHeader deckId={deckId} />
				</Suspense>
			</ErrorBoundary>

			{/* Cards Section */}
			<div className="flex items-center justify-between mb-4">
				<h2 className="font-display text-xl font-medium text-slate">
					Cards <span className="text-muted font-normal">({cards.length})</span>
				</h2>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onImportNotes}
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
						onClick={onCreateNote}
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

			{/* Search */}
			<div className="relative mb-6">
				<FontAwesomeIcon
					icon={faMagnifyingGlass}
					className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
					aria-hidden="true"
				/>
				<input
					type="text"
					value={searchInput}
					onChange={handleSearchChange}
					placeholder="Search cards..."
					className="w-full pl-10 pr-9 py-2.5 bg-white border border-border/50 rounded-lg text-sm text-slate placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
				/>
				{searchInput && (
					<button
						type="button"
						onClick={handleClearSearch}
						className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-slate transition-colors"
					>
						<FontAwesomeIcon
							icon={faXmark}
							className="w-4 h-4"
							aria-hidden="true"
						/>
					</button>
				)}
			</div>

			{/* Card List */}
			<CardList
				deckId={deckId}
				searchQuery={searchQuery}
				onEditNote={onEditNote}
				onDeleteNote={onDeleteNote}
				onCreateNote={onCreateNote}
			/>
		</div>
	);
}

export function DeckCardsPage() {
	const { deckId } = useParams<{ deckId: string }>();

	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [isImportModalOpen, setIsImportModalOpen] = useState(false);
	const [editingCard, setEditingCard] = useState<Card | null>(null);
	const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
	const [deletingCard, setDeletingCard] = useState<Card | null>(null);
	const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

	const handleCardMutation = () => {
		queryClient.invalidateQueries({ queryKey: ["decks", deckId, "cards"] });
	};

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
			<main className="max-w-4xl mx-auto px-4 py-8">
				<ErrorBoundary>
					<Suspense
						fallback={
							<div className="animate-fade-in">
								<div className="mb-8">
									<div className="h-9 w-48 bg-muted/20 rounded animate-pulse mb-2" />
									<div className="h-5 w-64 bg-muted/20 rounded animate-pulse" />
								</div>
								<div className="flex items-center justify-between mb-4">
									<div className="h-7 w-32 bg-muted/20 rounded animate-pulse" />
									<div className="flex gap-2">
										<div className="h-10 w-28 bg-muted/20 rounded-lg animate-pulse" />
										<div className="h-10 w-24 bg-muted/20 rounded-lg animate-pulse" />
									</div>
								</div>
								<div className="h-10 w-full bg-muted/20 rounded-lg animate-pulse mb-6" />
								<div className="space-y-4">
									{[0, 1, 2].map((i) => (
										<div
											key={i}
											className="bg-white rounded-xl border border-border/50 overflow-hidden"
										>
											<div className="px-5 py-3 border-b border-border/30 bg-ivory/30">
												<div className="h-4 w-28 bg-muted/20 rounded animate-pulse" />
											</div>
											<div className="p-5">
												<div className="grid grid-cols-2 gap-4">
													<div>
														<div className="h-3 w-10 bg-muted/20 rounded animate-pulse mb-2" />
														<div className="h-4 w-32 bg-muted/20 rounded animate-pulse" />
													</div>
													<div>
														<div className="h-3 w-10 bg-muted/20 rounded animate-pulse mb-2" />
														<div className="h-4 w-32 bg-muted/20 rounded animate-pulse" />
													</div>
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
						}
					>
						<CardsContent
							deckId={deckId}
							onCreateNote={() => setIsCreateModalOpen(true)}
							onImportNotes={() => setIsImportModalOpen(true)}
							onEditNote={setEditingNoteId}
							onDeleteNote={setDeletingNoteId}
						/>
					</Suspense>
				</ErrorBoundary>
			</main>

			{/* Modals */}
			<CreateNoteModal
				isOpen={isCreateModalOpen}
				deckId={deckId}
				onClose={() => setIsCreateModalOpen(false)}
				onNoteCreated={handleCardMutation}
			/>

			<ImportNotesModal
				isOpen={isImportModalOpen}
				deckId={deckId}
				onClose={() => setIsImportModalOpen(false)}
				onImportComplete={handleCardMutation}
			/>

			<EditCardModal
				isOpen={editingCard !== null}
				deckId={deckId}
				card={editingCard}
				onClose={() => setEditingCard(null)}
				onCardUpdated={handleCardMutation}
			/>

			<EditNoteModal
				isOpen={editingNoteId !== null}
				deckId={deckId}
				noteId={editingNoteId}
				onClose={() => setEditingNoteId(null)}
				onNoteUpdated={handleCardMutation}
			/>

			<DeleteCardModal
				isOpen={deletingCard !== null}
				deckId={deckId}
				card={deletingCard}
				onClose={() => setDeletingCard(null)}
				onCardDeleted={handleCardMutation}
			/>

			<DeleteNoteModal
				isOpen={deletingNoteId !== null}
				deckId={deckId}
				noteId={deletingNoteId}
				onClose={() => setDeletingNoteId(null)}
				onNoteDeleted={handleCardMutation}
			/>
		</div>
	);
}
