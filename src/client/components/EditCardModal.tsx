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
			const authHeader = apiClient.getAuthHeader();
			if (!authHeader) {
				throw new ApiClientError("Not authenticated", 401);
			}

			const res = await fetch(`/api/decks/${deckId}/cards/${card.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					...authHeader,
				},
				body: JSON.stringify({
					front: front.trim(),
					back: back.trim(),
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
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundColor: "rgba(0, 0, 0, 0.5)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				zIndex: 1000,
			}}
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
			<div
				style={{
					backgroundColor: "white",
					padding: "1.5rem",
					borderRadius: "8px",
					width: "100%",
					maxWidth: "500px",
					margin: "1rem",
				}}
			>
				<h2 id="edit-card-title" style={{ marginTop: 0 }}>
					Edit Card
				</h2>

				<form onSubmit={handleSubmit}>
					{error && (
						<div role="alert" style={{ color: "red", marginBottom: "1rem" }}>
							{error}
						</div>
					)}

					<div style={{ marginBottom: "1rem" }}>
						<label
							htmlFor="edit-card-front"
							style={{ display: "block", marginBottom: "0.25rem" }}
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
							style={{
								width: "100%",
								boxSizing: "border-box",
								resize: "vertical",
							}}
						/>
					</div>

					<div style={{ marginBottom: "1rem" }}>
						<label
							htmlFor="edit-card-back"
							style={{ display: "block", marginBottom: "0.25rem" }}
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
							style={{
								width: "100%",
								boxSizing: "border-box",
								resize: "vertical",
							}}
						/>
					</div>

					<div
						style={{
							display: "flex",
							gap: "0.5rem",
							justifyContent: "flex-end",
						}}
					>
						<button type="button" onClick={handleClose} disabled={isSubmitting}>
							Cancel
						</button>
						<button type="submit" disabled={isSubmitting || !isFormValid}>
							{isSubmitting ? "Saving..." : "Save"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
