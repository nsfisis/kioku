import { type FormEvent, useEffect, useState } from "react";
import { ApiClientError, apiClient } from "../api";

interface Card {
	id: string;
	front: string;
	back: string;
}

interface EditCardModalProps {
	isOpen: boolean;
	deckId: string;
	card: Card | null;
	onClose: () => void;
	onCardUpdated: () => void;
}

export function EditCardModal({
	isOpen,
	deckId,
	card,
	onClose,
	onCardUpdated,
}: EditCardModalProps) {
	const [front, setFront] = useState("");
	const [back, setBack] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Sync form state when card changes
	useEffect(() => {
		if (card) {
			setFront(card.front);
			setBack(card.back);
			setError(null);
		}
	}, [card]);

	const handleClose = () => {
		setError(null);
		onClose();
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!card) return;

		setError(null);
		setIsSubmitting(true);

		try {
			const res = await apiClient.rpc.api.decks[":deckId"].cards[
				":cardId"
			].$put({
				param: { deckId, cardId: card.id },
				json: {
					front: front.trim(),
					back: back.trim(),
				},
			});
			await apiClient.handleResponse(res);

			onCardUpdated();
			onClose();
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to update card. Please try again.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!isOpen || !card) {
		return null;
	}

	const isFormValid = front.trim() && back.trim();

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="edit-card-title"
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
			<div className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-scale-in">
				<div className="p-6">
					<h2
						id="edit-card-title"
						className="font-display text-xl font-medium text-ink mb-6"
					>
						Edit Card
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
								htmlFor="edit-card-front"
								className="block text-sm font-medium text-slate mb-1.5"
							>
								Front
							</label>
							<textarea
								id="edit-card-front"
								value={front}
								onChange={(e) => setFront(e.target.value)}
								required
								disabled={isSubmitting}
								rows={3}
								placeholder="Question or prompt"
								className="w-full px-4 py-2.5 bg-ivory border border-border rounded-lg text-slate placeholder-muted transition-all duration-200 hover:border-muted focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
							/>
						</div>

						<div>
							<label
								htmlFor="edit-card-back"
								className="block text-sm font-medium text-slate mb-1.5"
							>
								Back
							</label>
							<textarea
								id="edit-card-back"
								value={back}
								onChange={(e) => setBack(e.target.value)}
								required
								disabled={isSubmitting}
								rows={3}
								placeholder="Answer or explanation"
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
								disabled={isSubmitting || !isFormValid}
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
