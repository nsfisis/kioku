import { type FormEvent, useEffect, useState } from "react";
import { ApiClientError, apiClient } from "../api";

interface NoteType {
	id: string;
	name: string;
	frontTemplate: string;
	backTemplate: string;
	isReversible: boolean;
}

interface EditNoteTypeModalProps {
	isOpen: boolean;
	noteType: NoteType | null;
	onClose: () => void;
	onNoteTypeUpdated: () => void;
}

export function EditNoteTypeModal({
	isOpen,
	noteType,
	onClose,
	onNoteTypeUpdated,
}: EditNoteTypeModalProps) {
	const [name, setName] = useState("");
	const [frontTemplate, setFrontTemplate] = useState("");
	const [backTemplate, setBackTemplate] = useState("");
	const [isReversible, setIsReversible] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Sync form state when noteType changes
	useEffect(() => {
		if (noteType) {
			setName(noteType.name);
			setFrontTemplate(noteType.frontTemplate);
			setBackTemplate(noteType.backTemplate);
			setIsReversible(noteType.isReversible);
			setError(null);
		}
	}, [noteType]);

	const handleClose = () => {
		setError(null);
		onClose();
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!noteType) return;

		setError(null);
		setIsSubmitting(true);

		try {
			const authHeader = apiClient.getAuthHeader();
			if (!authHeader) {
				throw new ApiClientError("Not authenticated", 401);
			}

			const res = await fetch(`/api/note-types/${noteType.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					...authHeader,
				},
				body: JSON.stringify({
					name: name.trim(),
					frontTemplate: frontTemplate.trim(),
					backTemplate: backTemplate.trim(),
					isReversible,
				}),
			});

			if (!res.ok) {
				const errorBody = await res.json().catch(() => ({}));
				throw new ApiClientError(
					(errorBody as { error?: string }).error ||
						`Request failed with status ${res.status}`,
					res.status,
				);
			}

			onNoteTypeUpdated();
			onClose();
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to update note type. Please try again.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!isOpen || !noteType) {
		return null;
	}

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="edit-note-type-title"
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
					<h2
						id="edit-note-type-title"
						className="font-display text-xl font-medium text-ink mb-6"
					>
						Edit Note Type
					</h2>

					<form onSubmit={handleSubmit} className="space-y-4">
						{error && (
							<div
								role="alert"
								className="bg-error/5 text-error text-sm px-4 py-3 rounded-lg border border-error/20"
							>
								{error}
							</div>
						)}

						<div>
							<label
								htmlFor="edit-note-type-name"
								className="block text-sm font-medium text-slate mb-1.5"
							>
								Name
							</label>
							<input
								id="edit-note-type-name"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								maxLength={255}
								disabled={isSubmitting}
								className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate placeholder-muted transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
							/>
						</div>

						<div>
							<label
								htmlFor="edit-front-template"
								className="block text-sm font-medium text-slate mb-1.5"
							>
								Front Template
							</label>
							<textarea
								id="edit-front-template"
								value={frontTemplate}
								onChange={(e) => setFrontTemplate(e.target.value)}
								required
								maxLength={1000}
								disabled={isSubmitting}
								rows={3}
								className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate placeholder-muted font-mono text-sm transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed resize-y"
							/>
							<p className="text-muted text-xs mt-1">
								Use {"{{FieldName}}"} to insert field values
							</p>
						</div>

						<div>
							<label
								htmlFor="edit-back-template"
								className="block text-sm font-medium text-slate mb-1.5"
							>
								Back Template
							</label>
							<textarea
								id="edit-back-template"
								value={backTemplate}
								onChange={(e) => setBackTemplate(e.target.value)}
								required
								maxLength={1000}
								disabled={isSubmitting}
								rows={3}
								className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate placeholder-muted font-mono text-sm transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed resize-y"
							/>
						</div>

						<div className="flex items-center gap-3">
							<input
								id="edit-is-reversible"
								type="checkbox"
								checked={isReversible}
								onChange={(e) => setIsReversible(e.target.checked)}
								disabled={isSubmitting}
								className="w-4 h-4 text-primary bg-ivory border-border rounded focus:ring-primary/20 focus:ring-2 disabled:opacity-50"
							/>
							<label
								htmlFor="edit-is-reversible"
								className="text-sm font-medium text-slate"
							>
								Create reversed cards
							</label>
						</div>
						<p className="text-muted text-xs -mt-2 ml-7">
							Only affects new notes; existing cards are not modified
						</p>

						<div className="flex gap-3 justify-end pt-2">
							<button
								type="button"
								onClick={handleClose}
								disabled={isSubmitting}
								className="px-4 py-2 text-slate hover:bg-ivory rounded-lg transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={isSubmitting || !name.trim()}
								className="px-4 py-2 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isSubmitting ? "Saving..." : "Save Changes"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
