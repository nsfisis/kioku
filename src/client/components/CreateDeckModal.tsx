import { type FormEvent, useState } from "react";
import { ApiClientError, apiClient } from "../api";

interface CreateDeckModalProps {
	isOpen: boolean;
	onClose: () => void;
	onDeckCreated: () => void;
}

export function CreateDeckModal({
	isOpen,
	onClose,
	onDeckCreated,
}: CreateDeckModalProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const resetForm = () => {
		setName("");
		setDescription("");
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
			const res = await apiClient.rpc.api.decks.$post(
				{
					json: {
						name: name.trim(),
						description: description.trim() || null,
					},
				},
				{
					headers: apiClient.getAuthHeader(),
				},
			);

			if (!res.ok) {
				const errorBody = await res.json().catch(() => ({}));
				throw new ApiClientError(
					(errorBody as { error?: string }).error ||
						`Request failed with status ${res.status}`,
					res.status,
				);
			}

			resetForm();
			onDeckCreated();
			onClose();
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to create deck. Please try again.");
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
			aria-labelledby="create-deck-title"
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
						id="create-deck-title"
						className="font-display text-xl font-medium text-ink mb-6"
					>
						Create New Deck
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
								htmlFor="deck-name"
								className="block text-sm font-medium text-slate mb-1.5"
							>
								Name
							</label>
							<input
								id="deck-name"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								maxLength={255}
								disabled={isSubmitting}
								className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate placeholder-muted transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
								placeholder="My New Deck"
							/>
						</div>

						<div>
							<label
								htmlFor="deck-description"
								className="block text-sm font-medium text-slate mb-1.5"
							>
								Description{" "}
								<span className="text-muted font-normal">(optional)</span>
							</label>
							<textarea
								id="deck-description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								maxLength={1000}
								disabled={isSubmitting}
								rows={3}
								className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate placeholder-muted transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
								placeholder="What will you learn?"
							/>
						</div>

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
								{isSubmitting ? "Creating..." : "Create Deck"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
