import { type FormEvent, useState } from "react";
import { ApiClientError, apiClient } from "../api";

interface CreateCardModalProps {
	isOpen: boolean;
	deckId: string;
	onClose: () => void;
	onCardCreated: () => void;
}

export function CreateCardModal({
	isOpen,
	deckId,
	onClose,
	onCardCreated,
}: CreateCardModalProps) {
	const [front, setFront] = useState("");
	const [back, setBack] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const resetForm = () => {
		setFront("");
		setBack("");
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
			const res = await apiClient.rpc.api.decks[":deckId"].cards.$post(
				{
					param: { deckId },
					json: {
						front: front.trim(),
						back: back.trim(),
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
			onCardCreated();
			onClose();
		} catch (err) {
			if (err instanceof ApiClientError) {
				setError(err.message);
			} else {
				setError("Failed to create card. Please try again.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!isOpen) {
		return null;
	}

	const isFormValid = front.trim() && back.trim();

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="create-card-title"
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
				<h2 id="create-card-title" style={{ marginTop: 0 }}>
					Create New Card
				</h2>

				<form onSubmit={handleSubmit}>
					{error && (
						<div role="alert" style={{ color: "red", marginBottom: "1rem" }}>
							{error}
						</div>
					)}

					<div style={{ marginBottom: "1rem" }}>
						<label
							htmlFor="card-front"
							style={{ display: "block", marginBottom: "0.25rem" }}
						>
							Front
						</label>
						<textarea
							id="card-front"
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
							htmlFor="card-back"
							style={{ display: "block", marginBottom: "0.25rem" }}
						>
							Back
						</label>
						<textarea
							id="card-back"
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
							{isSubmitting ? "Creating..." : "Create"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
