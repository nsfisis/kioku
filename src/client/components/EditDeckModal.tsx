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
			const authHeader = apiClient.getAuthHeader();
			if (!authHeader) {
				throw new ApiClientError("Not authenticated", 401);
			}

			const res = await fetch(`/api/decks/${deck.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					...authHeader,
				},
				body: JSON.stringify({
					name: name.trim(),
					description: description.trim() || null,
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
				<h2 id="edit-deck-title" style={{ marginTop: 0 }}>
					Edit Deck
				</h2>

				<form onSubmit={handleSubmit}>
					{error && (
						<div role="alert" style={{ color: "red", marginBottom: "1rem" }}>
							{error}
						</div>
					)}

					<div style={{ marginBottom: "1rem" }}>
						<label
							htmlFor="edit-deck-name"
							style={{ display: "block", marginBottom: "0.25rem" }}
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
							style={{ width: "100%", boxSizing: "border-box" }}
						/>
					</div>

					<div style={{ marginBottom: "1rem" }}>
						<label
							htmlFor="edit-deck-description"
							style={{ display: "block", marginBottom: "0.25rem" }}
						>
							Description (optional)
						</label>
						<textarea
							id="edit-deck-description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							maxLength={1000}
							disabled={isSubmitting}
							rows={3}
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
						<button type="submit" disabled={isSubmitting || !name.trim()}>
							{isSubmitting ? "Saving..." : "Save"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
