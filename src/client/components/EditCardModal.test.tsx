/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../api/client";

vi.mock("../api/client", () => ({
	apiClient: {
		getAuthHeader: vi.fn(),
	},
	ApiClientError: class ApiClientError extends Error {
		constructor(
			message: string,
			public status: number,
			public code?: string,
		) {
			super(message);
			this.name = "ApiClientError";
		}
	},
}));

// Import after mock is set up
import { EditCardModal } from "./EditCardModal";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("EditCardModal", () => {
	const mockCard = {
		id: "card-123",
		front: "Test front",
		back: "Test back",
	};

	const defaultProps = {
		isOpen: true,
		deckId: "deck-456",
		card: mockCard,
		onClose: vi.fn(),
		onCardUpdated: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiClient.getAuthHeader).mockReturnValue({
			Authorization: "Bearer access-token",
		});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("does not render when closed", () => {
		render(<EditCardModal {...defaultProps} isOpen={false} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("does not render when card is null", () => {
		render(<EditCardModal {...defaultProps} card={null} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders modal when open with card", () => {
		render(<EditCardModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(screen.getByRole("heading", { name: "Edit Card" })).toBeDefined();
		expect(screen.getByLabelText("Front")).toBeDefined();
		expect(screen.getByLabelText("Back")).toBeDefined();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
	});

	it("populates form with card values", () => {
		render(<EditCardModal {...defaultProps} />);

		expect(screen.getByLabelText("Front")).toHaveProperty(
			"value",
			"Test front",
		);
		expect(screen.getByLabelText("Back")).toHaveProperty("value", "Test back");
	});

	it("disables save button when front is empty", async () => {
		const user = userEvent.setup();
		render(<EditCardModal {...defaultProps} />);

		const frontInput = screen.getByLabelText("Front");
		await user.clear(frontInput);

		const saveButton = screen.getByRole("button", { name: "Save" });
		expect(saveButton).toHaveProperty("disabled", true);
	});

	it("disables save button when back is empty", async () => {
		const user = userEvent.setup();
		render(<EditCardModal {...defaultProps} />);

		const backInput = screen.getByLabelText("Back");
		await user.clear(backInput);

		const saveButton = screen.getByRole("button", { name: "Save" });
		expect(saveButton).toHaveProperty("disabled", true);
	});

	it("enables save button when both front and back have content", () => {
		render(<EditCardModal {...defaultProps} />);

		const saveButton = screen.getByRole("button", { name: "Save" });
		expect(saveButton).toHaveProperty("disabled", false);
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<EditCardModal {...defaultProps} onClose={onClose} />);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("calls onClose when clicking outside the modal", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<EditCardModal {...defaultProps} onClose={onClose} />);

		// Click on the backdrop (the dialog element itself)
		const dialog = screen.getByRole("dialog");
		await user.click(dialog);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("does not call onClose when clicking inside the modal content", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<EditCardModal {...defaultProps} onClose={onClose} />);

		// Click on an element inside the modal
		await user.click(screen.getByLabelText("Front"));

		expect(onClose).not.toHaveBeenCalled();
	});

	it("updates card with new front", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onCardUpdated = vi.fn();

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				card: {
					id: "card-123",
					front: "Updated front",
					back: "Test back",
				},
			}),
		});

		render(
			<EditCardModal
				isOpen={true}
				deckId="deck-456"
				card={mockCard}
				onClose={onClose}
				onCardUpdated={onCardUpdated}
			/>,
		);

		const frontInput = screen.getByLabelText("Front");
		await user.clear(frontInput);
		await user.type(frontInput, "Updated front");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith(
				"/api/decks/deck-456/cards/card-123",
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Bearer access-token",
					},
					body: JSON.stringify({
						front: "Updated front",
						back: "Test back",
					}),
				},
			);
		});

		expect(onCardUpdated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("updates card with new back", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onCardUpdated = vi.fn();

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				card: {
					id: "card-123",
					front: "Test front",
					back: "Updated back",
				},
			}),
		});

		render(
			<EditCardModal
				isOpen={true}
				deckId="deck-456"
				card={mockCard}
				onClose={onClose}
				onCardUpdated={onCardUpdated}
			/>,
		);

		const backInput = screen.getByLabelText("Back");
		await user.clear(backInput);
		await user.type(backInput, "Updated back");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith(
				"/api/decks/deck-456/cards/card-123",
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Bearer access-token",
					},
					body: JSON.stringify({
						front: "Test front",
						back: "Updated back",
					}),
				},
			);
		});

		expect(onCardUpdated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("trims whitespace from front and back", async () => {
		const user = userEvent.setup();

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ card: { id: "card-123" } }),
		});

		const cardWithWhitespace = {
			...mockCard,
			front: "  Front  ",
			back: "  Back  ",
		};
		render(<EditCardModal {...defaultProps} card={cardWithWhitespace} />);

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith(
				"/api/decks/deck-456/cards/card-123",
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Bearer access-token",
					},
					body: JSON.stringify({
						front: "Front",
						back: "Back",
					}),
				},
			);
		});
	});

	it("shows loading state during submission", async () => {
		const user = userEvent.setup();

		mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

		render(<EditCardModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(screen.getByRole("button", { name: "Saving..." })).toBeDefined();
		expect(screen.getByRole("button", { name: "Saving..." })).toHaveProperty(
			"disabled",
			true,
		);
		expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty(
			"disabled",
			true,
		);
		expect(screen.getByLabelText("Front")).toHaveProperty("disabled", true);
		expect(screen.getByLabelText("Back")).toHaveProperty("disabled", true);
	});

	it("displays API error message", async () => {
		const user = userEvent.setup();

		mockFetch.mockResolvedValue({
			ok: false,
			status: 400,
			json: async () => ({ error: "Card not found" }),
		});

		render(<EditCardModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain("Card not found");
		});
	});

	it("displays generic error on unexpected failure", async () => {
		const user = userEvent.setup();

		mockFetch.mockRejectedValue(new Error("Network error"));

		render(<EditCardModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to update card. Please try again.",
			);
		});
	});

	it("displays error when not authenticated", async () => {
		const user = userEvent.setup();

		vi.mocked(apiClient.getAuthHeader).mockReturnValue(undefined);

		render(<EditCardModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Not authenticated",
			);
		});
	});

	it("updates form when card prop changes", () => {
		const { rerender } = render(<EditCardModal {...defaultProps} />);

		expect(screen.getByLabelText("Front")).toHaveProperty(
			"value",
			"Test front",
		);

		const newCard = {
			...mockCard,
			front: "New front",
			back: "New back",
		};
		rerender(<EditCardModal {...defaultProps} card={newCard} />);

		expect(screen.getByLabelText("Front")).toHaveProperty("value", "New front");
		expect(screen.getByLabelText("Back")).toHaveProperty("value", "New back");
	});

	it("clears error when modal is closed", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		mockFetch.mockResolvedValue({
			ok: false,
			status: 400,
			json: async () => ({ error: "Some error" }),
		});

		const { rerender } = render(
			<EditCardModal {...defaultProps} onClose={onClose} />,
		);

		// Trigger error
		await user.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeDefined();
		});

		// Close and reopen the modal
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		rerender(<EditCardModal {...defaultProps} onClose={onClose} />);

		// Error should be cleared
		expect(screen.queryByRole("alert")).toBeNull();
	});
});
