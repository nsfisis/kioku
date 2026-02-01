import {
	faBoxOpen,
	faLayerGroup,
	faPen,
	faPlus,
	faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAtomValue, useSetAtom } from "jotai";
import { Suspense, useState } from "react";
import { Link } from "wouter";
import { type Deck, decksAtom, logoutAtom } from "../atoms";
import { CreateDeckModal } from "../components/CreateDeckModal";
import { DeleteDeckModal } from "../components/DeleteDeckModal";
import { EditDeckModal } from "../components/EditDeckModal";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { SyncButton } from "../components/SyncButton";
import { SyncStatusIndicator } from "../components/SyncStatusIndicator";
import { queryClient } from "../queryClient";

function DeckList({
	onEditDeck,
	onDeleteDeck,
}: {
	onEditDeck: (deck: Deck) => void;
	onDeleteDeck: (deck: Deck) => void;
}) {
	const { data: decks } = useAtomValue(decksAtom);

	if (decks.length === 0) {
		return (
			<div className="text-center py-16 animate-fade-in">
				<div className="w-16 h-16 mx-auto mb-4 bg-ivory rounded-2xl flex items-center justify-center">
					<FontAwesomeIcon
						icon={faBoxOpen}
						className="w-8 h-8 text-muted"
						aria-hidden="true"
					/>
				</div>
				<h3 className="font-display text-lg font-medium text-slate mb-2">
					No decks yet
				</h3>
				<p className="text-muted text-sm mb-6">
					Create your first deck to start learning
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3 animate-fade-in">
			{decks.map((deck, index) => (
				<div
					key={deck.id}
					className="bg-white rounded-xl border border-border/50 p-5 shadow-card hover:shadow-md transition-all duration-200 group"
					style={{ animationDelay: `${index * 50}ms` }}
				>
					<div className="flex items-start justify-between gap-4">
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-3">
								<Link
									href={`/decks/${deck.id}`}
									className="block group-hover:text-primary transition-colors flex-1 min-w-0"
								>
									<h3 className="font-display text-lg font-medium text-slate truncate">
										{deck.name}
									</h3>
								</Link>
								{deck.dueCardCount > 0 && (
									<span className="shrink-0 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 bg-primary text-white text-sm font-medium rounded-full">
										{deck.dueCardCount}
									</span>
								)}
							</div>
							{deck.description && (
								<p className="text-muted text-sm mt-1 line-clamp-2">
									{deck.description}
								</p>
							)}
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<button
								type="button"
								onClick={() => onEditDeck(deck)}
								className="p-2 text-muted hover:text-slate hover:bg-ivory rounded-lg transition-colors"
								title="Edit deck"
							>
								<FontAwesomeIcon
									icon={faPen}
									className="w-4 h-4"
									aria-hidden="true"
								/>
							</button>
							<button
								type="button"
								onClick={() => onDeleteDeck(deck)}
								className="p-2 text-muted hover:text-error hover:bg-error/5 rounded-lg transition-colors"
								title="Delete deck"
							>
								<FontAwesomeIcon
									icon={faTrash}
									className="w-4 h-4"
									aria-hidden="true"
								/>
							</button>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

export function HomePage() {
	const logout = useSetAtom(logoutAtom);

	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
	const [deletingDeck, setDeletingDeck] = useState<Deck | null>(null);

	const handleDeckMutation = () => {
		queryClient.invalidateQueries({ queryKey: ["decks"] });
	};

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
						<Link
							href="/note-types"
							className="p-2 text-muted hover:text-slate hover:bg-ivory rounded-lg transition-colors"
							title="Manage Note Types"
						>
							<FontAwesomeIcon
								icon={faLayerGroup}
								className="w-4 h-4"
								aria-hidden="true"
							/>
							<span className="sr-only">Manage Note Types</span>
						</Link>
						<button
							type="button"
							onClick={() => logout()}
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
						<FontAwesomeIcon
							icon={faPlus}
							className="w-5 h-5"
							aria-hidden="true"
						/>
						New Deck
					</button>
				</div>

				{/* Deck List with Suspense */}
				<ErrorBoundary>
					<Suspense fallback={<LoadingSpinner />}>
						<DeckList
							onEditDeck={setEditingDeck}
							onDeleteDeck={setDeletingDeck}
						/>
					</Suspense>
				</ErrorBoundary>
			</main>

			{/* Modals */}
			<CreateDeckModal
				isOpen={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
				onDeckCreated={handleDeckMutation}
			/>

			<EditDeckModal
				isOpen={editingDeck !== null}
				deck={editingDeck}
				onClose={() => setEditingDeck(null)}
				onDeckUpdated={handleDeckMutation}
			/>

			<DeleteDeckModal
				isOpen={deletingDeck !== null}
				deck={deletingDeck}
				onClose={() => setDeletingDeck(null)}
				onDeckDeleted={handleDeckMutation}
			/>
		</div>
	);
}
