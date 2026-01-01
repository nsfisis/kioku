import { type FormEvent, useEffect, useState } from "react";
import { ApiClientError, apiClient } from "../api";

interface Deck {
	id: string;
	name: string;
	description: string | null;
	newCardsPerDay: number;
}

interface EditDeckModalProps {
	isOpen: boolean;
	deck: Deck | null;
	onClose: () => void;
	onDeckUpdated: () => void;
}

export function EditDeckModal({
	isOpen,
	deck,
	onClose,
	onDeckUpdated,
}: EditDeckModalProps) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Sync form state when deck changes
	useEffect(() => {
		if (deck) {
			setName(deck.name);
			setDescription(deck.description ?? "");
			setError(null);
		}
	}, [deck]);

	const handleClose = () => {
		setError(null);
		onClose();
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!deck) return;

		setError(null);
		setIsSubmitting(true);

		try {
			const res = await apiClient.rpc.api.decks[":id"].$put({
				param: { id: deck.id },
				json: {
					name: name.trim(),
					description: description.trim() || null,
				},
			});
			await apiClient.handleResponse(res);

			onDeckUpdated();
			onClose();
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to update deck. Please try again.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!isOpen || !deck) {
		return null;
	}

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="edit-deck-title"
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
						id="edit-deck-title"
						className="font-display text-xl font-medium text-ink mb-6"
					>
						Edit Deck
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
								htmlFor="edit-deck-name"
								className="block text-sm font-medium text-slate mb-1.5"
							>
								Name
							</label>
							<input
								id="edit-deck-name"
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
								htmlFor="edit-deck-description"
								className="block text-sm font-medium text-slate mb-1.5"
							>
								Description{" "}
								<span className="text-muted font-normal">(optional)</span>
							</label>
							<textarea
								id="edit-deck-description"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								maxLength={1000}
								disabled={isSubmitting}
								rows={3}
								className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate placeholder-muted transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
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
								{isSubmitting ? "Saving..." : "Save Changes"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}
