import {
	faArrowLeft,
	faBoxOpen,
	faLayerGroup,
	faPen,
	faPlus,
	faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAtomValue } from "jotai";
import { Suspense, useState } from "react";
import { Link } from "wouter";
import { type NoteType, noteTypesAtom } from "../atoms";
import { CreateNoteTypeModal } from "../components/CreateNoteTypeModal";
import { DeleteNoteTypeModal } from "../components/DeleteNoteTypeModal";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { NoteTypeEditor } from "../components/NoteTypeEditor";
import { queryClient } from "../queryClient";

function NoteTypeList({
	onEditNoteType,
	onDeleteNoteType,
}: {
	onEditNoteType: (id: string) => void;
	onDeleteNoteType: (noteType: NoteType) => void;
}) {
	const { data: noteTypes } = useAtomValue(noteTypesAtom);

	if (noteTypes.length === 0) {
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
					No note types yet
				</h3>
				<p className="text-muted text-sm mb-6">
					Create a note type to define how your cards are structured
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3 animate-fade-in">
			{noteTypes.map((noteType, index) => (
				<div
					key={noteType.id}
					className="bg-white rounded-xl border border-border/50 p-5 shadow-card hover:shadow-md transition-all duration-200 group"
					style={{ animationDelay: `${index * 50}ms` }}
				>
					<div className="flex items-start justify-between gap-4">
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 mb-1">
								<FontAwesomeIcon
									icon={faLayerGroup}
									className="w-4 h-4 text-muted"
									aria-hidden="true"
								/>
								<h3 className="font-display text-lg font-medium text-slate truncate">
									{noteType.name}
								</h3>
							</div>
							<div className="flex flex-wrap gap-2 mt-2">
								<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-ivory text-muted">
									Front: {noteType.frontTemplate}
								</span>
								<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-ivory text-muted">
									Back: {noteType.backTemplate}
								</span>
								{noteType.isReversible && (
									<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
										Reversible
									</span>
								)}
							</div>
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<button
								type="button"
								onClick={() => onEditNoteType(noteType.id)}
								className="p-2 text-muted hover:text-slate hover:bg-ivory rounded-lg transition-colors"
								title="Edit note type"
							>
								<FontAwesomeIcon
									icon={faPen}
									className="w-4 h-4"
									aria-hidden="true"
								/>
							</button>
							<button
								type="button"
								onClick={() => onDeleteNoteType(noteType)}
								className="p-2 text-muted hover:text-error hover:bg-error/5 rounded-lg transition-colors"
								title="Delete note type"
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

export function NoteTypesPage() {
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [editingNoteTypeId, setEditingNoteTypeId] = useState<string | null>(
		null,
	);
	const [deletingNoteType, setDeletingNoteType] = useState<NoteType | null>(
		null,
	);

	const handleNoteTypeMutation = () => {
		queryClient.invalidateQueries({ queryKey: ["noteTypes"] });
	};

	return (
		<div className="min-h-screen bg-cream">
			{/* Header */}
			<header className="bg-white border-b border-border/50 sticky top-0 z-10">
				<div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Link
							href="/"
							className="p-2 -ml-2 text-muted hover:text-slate hover:bg-ivory rounded-lg transition-colors"
						>
							<FontAwesomeIcon
								icon={faArrowLeft}
								className="w-4 h-4"
								aria-hidden="true"
							/>
							<span className="sr-only">Back to Home</span>
						</Link>
						<h1 className="font-display text-2xl font-semibold text-ink">
							Note Types
						</h1>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="max-w-4xl mx-auto px-4 py-8">
				{/* Section Header */}
				<div className="flex items-center justify-between mb-6">
					<p className="text-muted text-sm">
						Note types define how your cards are structured
					</p>
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
						New Note Type
					</button>
				</div>

				{/* Note Type List with Suspense */}
				<ErrorBoundary>
					<Suspense fallback={<LoadingSpinner />}>
						<NoteTypeList
							onEditNoteType={setEditingNoteTypeId}
							onDeleteNoteType={setDeletingNoteType}
						/>
					</Suspense>
				</ErrorBoundary>
			</main>

			{/* Modals */}
			<CreateNoteTypeModal
				isOpen={isCreateModalOpen}
				onClose={() => setIsCreateModalOpen(false)}
				onNoteTypeCreated={handleNoteTypeMutation}
			/>

			<NoteTypeEditor
				isOpen={editingNoteTypeId !== null}
				noteTypeId={editingNoteTypeId}
				onClose={() => setEditingNoteTypeId(null)}
				onNoteTypeUpdated={handleNoteTypeMutation}
			/>

			<DeleteNoteTypeModal
				isOpen={deletingNoteType !== null}
				noteType={deletingNoteType}
				onClose={() => setDeletingNoteType(null)}
				onNoteTypeDeleted={handleNoteTypeMutation}
			/>
		</div>
	);
}
