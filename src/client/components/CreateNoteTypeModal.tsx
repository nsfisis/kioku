import { type FormEvent, useState } from "react";
import { ApiClientError, apiClient } from "../api";

interface CreateNoteTypeModalProps {
	isOpen: boolean;
	onClose: () => void;
	onNoteTypeCreated: () => void;
}

export function CreateNoteTypeModal({
	isOpen,
	onClose,
	onNoteTypeCreated,
}: CreateNoteTypeModalProps) {
	const [name, setName] = useState("");
	const [frontTemplate, setFrontTemplate] = useState("{{Front}}");
	const [backTemplate, setBackTemplate] = useState("{{Back}}");
	const [isReversible, setIsReversible] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const resetForm = () => {
		setName("");
		setFrontTemplate("{{Front}}");
		setBackTemplate("{{Back}}");
		setIsReversible(false);
		setError(null);
	};

	const handleClose = () => {
		resetForm();
		onClose();
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setError(null);
		setIsSubmitting(true);

		try {
			const authHeader = apiClient.getAuthHeader();
			if (!authHeader) {
				throw new ApiClientError("Not authenticated", 401);
			}

			const res = await fetch("/api/note-types", {
				method: "POST",
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

			resetForm();
			onNoteTypeCreated();
			onClose();
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to create note type. Please try again.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!isOpen) {
		return null;
	}

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="create-note-type-title"
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
						id="create-note-type-title"
						className="font-display text-xl font-medium text-ink mb-6"
					>
						Create Note Type
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
								htmlFor="note-type-name"
								className="block text-sm font-medium text-slate mb-1.5"
							>
								Name
							</label>
							<input
								id="note-type-name"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								maxLength={255}
								disabled={isSubmitting}
								className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate placeholder-muted transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
								placeholder="Basic"
							/>
						</div>

						<div>
							<label
								htmlFor="front-template"
								className="block text-sm font-medium text-slate mb-1.5"
							>
								Front Template
							</label>
							<input
								id="front-template"
								type="text"
								value={frontTemplate}
								onChange={(e) => setFrontTemplate(e.target.value)}
								required
								maxLength={1000}
								disabled={isSubmitting}
								className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate placeholder-muted font-mono text-sm transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
								placeholder="{{Front}}"
							/>
							<p className="text-muted text-xs mt-1">
								Use {"{{FieldName}}"} to insert field values
							</p>
						</div>

						<div>
							<label
								htmlFor="back-template"
								className="block text-sm font-medium text-slate mb-1.5"
							>
								Back Template
							</label>
							<input
								id="back-template"
								type="text"
								value={backTemplate}
								onChange={(e) => setBackTemplate(e.target.value)}
								required
								maxLength={1000}
								disabled={isSubmitting}
								className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate placeholder-muted font-mono text-sm transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
								placeholder="{{Back}}"
							/>
						</div>

						<div className="flex items-center gap-3">
							<input
								id="is-reversible"
								type="checkbox"
								checked={isReversible}
								onChange={(e) => setIsReversible(e.target.checked)}
								disabled={isSubmitting}
								className="w-4 h-4 text-primary bg-ivory border-border rounded focus:ring-primary/20 focus:ring-2 disabled:opacity-50"
							/>
							<label
								htmlFor="is-reversible"
								className="text-sm font-medium text-slate"
							>
								Create reversed cards
							</label>
						</div>
						<p className="text-muted text-xs -mt-2 ml-7">
							When enabled, each note will generate both a normal and reversed
							card
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
								{isSubmitting ? "Creating..." : "Create"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
