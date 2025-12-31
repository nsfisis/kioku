import { useState } from "react";
import { ApiClientError, apiClient } from "../api";

interface DeleteNoteModalProps {
	isOpen: boolean;
	deckId: string;
	noteId: string | null;
	onClose: () => void;
	onNoteDeleted: () => void;
}

export function DeleteNoteModal({
	isOpen,
	deckId,
	noteId,
	onClose,
	onNoteDeleted,
}: DeleteNoteModalProps) {
	const [error, setError] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const handleClose = () => {
		setError(null);
		onClose();
	};

	const handleDelete = async () => {
		if (!noteId) return;

		setError(null);
		setIsDeleting(true);

		try {
			const authHeader = apiClient.getAuthHeader();
			if (!authHeader) {
				throw new ApiClientError("Not authenticated", 401);
			}

			const res = await fetch(`/api/decks/${deckId}/notes/${noteId}`, {
				method: "DELETE",
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

			onNoteDeleted();
			onClose();
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to delete note. Please try again.");
			}
		} finally {
			setIsDeleting(false);
		}
	};

	if (!isOpen || !noteId) {
		return null;
	}

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="delete-note-title"
			className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
			onClick={(e) => {
				if (e.target === e.currentTarget) {
					handleClose();
				}
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") {
					handleClose();
				}
			}}
		>
			<div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
				<div className="p-6">
					<div className="w-12 h-12 mx-auto mb-4 bg-error/10 rounded-full flex items-center justify-center">
						<svg
							className="w-6 h-6 text-error"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
					</div>

					<h2
						id="delete-note-title"
						className="font-display text-xl font-medium text-ink text-center mb-2"
					>
						Delete Note
					</h2>

					{error && (
						<div
							role="alert"
							className="bg-error/5 text-error text-sm px-4 py-3 rounded-lg border border-error/20 mb-4"
						>
							{error}
						</div>
					)}

					<p className="text-slate text-center mb-2">
						Are you sure you want to delete this note?
					</p>
					<p className="text-muted text-sm text-center mb-6">
						This will delete all cards generated from this note. This action
						cannot be undone.
					</p>

					<div className="flex gap-3 justify-center">
						<button
							type="button"
							onClick={handleClose}
							disabled={isDeleting}
							className="px-4 py-2 text-slate hover:bg-ivory rounded-lg transition-colors disabled:opacity-50 min-w-[100px]"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={handleDelete}
							disabled={isDeleting}
							className="px-4 py-2 bg-error hover:bg-error/90 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
						>
							{isDeleting ? "Deleting..." : "Delete"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
