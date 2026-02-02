import {
	faChevronLeft,
	faCirclePlay,
	faLayerGroup,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAtomValue } from "jotai";
import { Suspense } from "react";
import { Link, useParams } from "wouter";
import { getEndOfStudyDayBoundary } from "../../shared/date";
import { cardsByDeckAtomFamily, deckByIdAtomFamily } from "../atoms";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { LoadingSpinner } from "../components/LoadingSpinner";

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

function DeckStats({ deckId }: { deckId: string }) {
	const { data: cards } = useAtomValue(cardsByDeckAtomFamily(deckId));

	// Count cards due today (study day boundary is 3:00 AM)
	const boundary = getEndOfStudyDayBoundary();
	const dueCards = cards.filter((card) => new Date(card.due) < boundary);

	return (
		<div className="bg-white rounded-xl border border-border/50 p-6 mb-6">
			<div className="grid grid-cols-2 gap-6">
				<div>
					<p className="text-sm text-muted mb-1">Total Cards</p>
					<p className="text-2xl font-semibold text-ink">{cards.length}</p>
				</div>
				<div>
					<p className="text-sm text-muted mb-1">Due Today</p>
					<p className="text-2xl font-semibold text-primary">
						{dueCards.length}
					</p>
				</div>
			</div>
		</div>
	);
}

function DeckContent({ deckId }: { deckId: string }) {
	return (
		<div className="animate-fade-in">
			{/* Deck Header */}
			<ErrorBoundary>
				<Suspense fallback={<LoadingSpinner />}>
					<DeckHeader deckId={deckId} />
				</Suspense>
			</ErrorBoundary>

			{/* Deck Stats */}
			<ErrorBoundary>
				<Suspense fallback={<LoadingSpinner />}>
					<DeckStats deckId={deckId} />
				</Suspense>
			</ErrorBoundary>

			{/* Action Buttons */}
			<div className="space-y-4">
				{/* Study Button */}
				<Link
					href={`/decks/${deckId}/study`}
					className="flex items-center justify-center gap-3 w-full bg-success hover:bg-success/90 text-white font-medium py-4 px-6 rounded-xl transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow-md"
				>
					<FontAwesomeIcon
						icon={faCirclePlay}
						className="w-6 h-6"
						aria-hidden="true"
					/>
					<span className="text-lg">Study Now</span>
				</Link>

				{/* View Cards Link */}
				<Link
					href={`/decks/${deckId}/cards`}
					className="flex items-center justify-center gap-3 w-full border border-border hover:bg-ivory text-slate font-medium py-4 px-6 rounded-xl transition-all duration-200 active:scale-[0.98]"
				>
					<FontAwesomeIcon
						icon={faLayerGroup}
						className="w-5 h-5"
						aria-hidden="true"
					/>
					<span className="text-lg">View Cards</span>
				</Link>
			</div>
		</div>
	);
}

export function DeckDetailPage() {
	const { deckId } = useParams<{ deckId: string }>();

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
				<ErrorBoundary>
					<Suspense fallback={<LoadingSpinner />}>
						<DeckContent deckId={deckId} />
					</Suspense>
				</ErrorBoundary>
			</main>
		</div>
	);
}
