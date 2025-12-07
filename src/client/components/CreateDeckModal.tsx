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
				<h2 id="create-deck-title" style={{ marginTop: 0 }}>
					Create New Deck
				</h2>

				<form onSubmit={handleSubmit}>
					{error && (
						<div role="alert" style={{ color: "red", marginBottom: "1rem" }}>
							{error}
						</div>
					)}

					<div style={{ marginBottom: "1rem" }}>
						<label
							htmlFor="deck-name"
							style={{ display: "block", marginBottom: "0.25rem" }}
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
							style={{ width: "100%", boxSizing: "border-box" }}
						/>
					</div>

					<div style={{ marginBottom: "1rem" }}>
						<label
							htmlFor="deck-description"
							style={{ display: "block", marginBottom: "0.25rem" }}
						>
							Description (optional)
						</label>
						<textarea
							id="deck-description"
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
							{isSubmitting ? "Creating..." : "Create"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
