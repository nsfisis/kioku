import { useState } from "react";
import { ApiClientError, apiClient } from "../api";

interface Card {
	id: string;
	front: string;
}

interface DeleteCardModalProps {
	isOpen: boolean;
	deckId: string;
	card: Card | null;
	onClose: () => void;
	onCardDeleted: () => void;
}

export function DeleteCardModal({
	isOpen,
	deckId,
	card,
	onClose,
	onCardDeleted,
}: DeleteCardModalProps) {
	const [error, setError] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const handleClose = () => {
		setError(null);
		onClose();
	};

	const handleDelete = async () => {
		if (!card) return;

		setError(null);
		setIsDeleting(true);

		try {
			const authHeader = apiClient.getAuthHeader();
			if (!authHeader) {
				throw new ApiClientError("Not authenticated", 401);
			}

			const res = await fetch(`/api/decks/${deckId}/cards/${card.id}`, {
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

			onCardDeleted();
			onClose();
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to delete card. Please try again.");
			}
		} finally {
			setIsDeleting(false);
		}
	};

	if (!isOpen || !card) {
		return null;
	}

	// Truncate front text for display if too long
	const displayFront =
		card.front.length > 50 ? `${card.front.slice(0, 50)}...` : card.front;

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="delete-card-title"
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
					maxWidth: "400px",
					margin: "1rem",
				}}
			>
				<h2 id="delete-card-title" style={{ marginTop: 0 }}>
					Delete Card
				</h2>

				{error && (
					<div role="alert" style={{ color: "red", marginBottom: "1rem" }}>
						{error}
					</div>
				)}

				<p>Are you sure you want to delete this card?</p>
				<p style={{ color: "#666", fontStyle: "italic" }}>"{displayFront}"</p>
				<p style={{ color: "#666" }}>This action cannot be undone.</p>

				<div
					style={{
						display: "flex",
						gap: "0.5rem",
						justifyContent: "flex-end",
						marginTop: "1.5rem",
					}}
				>
					<button type="button" onClick={handleClose} disabled={isDeleting}>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleDelete}
						disabled={isDeleting}
						style={{
							backgroundColor: "#dc3545",
							color: "white",
							border: "none",
							padding: "0.5rem 1rem",
							borderRadius: "4px",
							cursor: isDeleting ? "not-allowed" : "pointer",
						}}
					>
						{isDeleting ? "Deleting..." : "Delete"}
					</button>
				</div>
			</div>
		</div>
	);
}
