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
import { DeleteCardModal } from "./DeleteCardModal";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("DeleteCardModal", () => {
	const mockCard = {
		id: "card-123",
		front: "Test Question",
	};

	const defaultProps = {
		isOpen: true,
		deckId: "deck-456",
		card: mockCard,
		onClose: vi.fn(),
		onCardDeleted: vi.fn(),
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
		render(<DeleteCardModal {...defaultProps} isOpen={false} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("does not render when card is null", () => {
		render(<DeleteCardModal {...defaultProps} card={null} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders modal when open with card", () => {
		render(<DeleteCardModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(screen.getByRole("heading", { name: "Delete Card" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
	});

	it("displays confirmation message with card front text", () => {
		render(<DeleteCardModal {...defaultProps} />);

		expect(screen.getByText(/Are you sure you want to delete/)).toBeDefined();
		expect(screen.getByText(/"Test Question"/)).toBeDefined();
	});

	it("truncates long front text in confirmation message", () => {
		const longFrontCard = {
			id: "card-123",
			front:
				"This is a very long question that should be truncated when displayed in the confirmation modal",
		};
		render(<DeleteCardModal {...defaultProps} card={longFrontCard} />);

		expect(
			screen.getByText(
				/"This is a very long question that should be trunca.../,
			),
		).toBeDefined();
	});

	it("displays warning about permanent deletion", () => {
		render(<DeleteCardModal {...defaultProps} />);

		expect(screen.getByText(/This action cannot be undone/)).toBeDefined();
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<DeleteCardModal {...defaultProps} onClose={onClose} />);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("calls onClose when clicking outside the modal", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<DeleteCardModal {...defaultProps} onClose={onClose} />);

		// Click on the backdrop (the dialog element itself)
		const dialog = screen.getByRole("dialog");
		await user.click(dialog);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("does not call onClose when clicking inside the modal content", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<DeleteCardModal {...defaultProps} onClose={onClose} />);

		// Click on the heading inside the modal
		await user.click(screen.getByRole("heading", { name: "Delete Card" }));

		expect(onClose).not.toHaveBeenCalled();
	});

	it("deletes card when Delete is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onCardDeleted = vi.fn();

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({}),
		});

		render(
			<DeleteCardModal
				isOpen={true}
				deckId="deck-456"
				card={mockCard}
				onClose={onClose}
				onCardDeleted={onCardDeleted}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith(
				"/api/decks/deck-456/cards/card-123",
				{
					method: "DELETE",
					headers: {
						Authorization: "Bearer access-token",
					},
				},
			);
		});

		expect(onCardDeleted).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("shows loading state during deletion", async () => {
		const user = userEvent.setup();

		mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

		render(<DeleteCardModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		expect(screen.getByRole("button", { name: "Deleting..." })).toBeDefined();
		expect(screen.getByRole("button", { name: "Deleting..." })).toHaveProperty(
			"disabled",
			true,
		);
		expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty(
			"disabled",
			true,
		);
	});

	it("displays API error message", async () => {
		const user = userEvent.setup();

		mockFetch.mockResolvedValue({
			ok: false,
			status: 404,
			json: async () => ({ error: "Card not found" }),
		});

		render(<DeleteCardModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain("Card not found");
		});
	});

	it("displays generic error on unexpected failure", async () => {
		const user = userEvent.setup();

		mockFetch.mockRejectedValue(new Error("Network error"));

		render(<DeleteCardModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to delete card. Please try again.",
			);
		});
	});

	it("displays error when not authenticated", async () => {
		const user = userEvent.setup();

		vi.mocked(apiClient.getAuthHeader).mockReturnValue(undefined);

		render(<DeleteCardModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Not authenticated",
			);
		});
	});

	it("clears error when modal is closed", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		mockFetch.mockResolvedValue({
			ok: false,
			status: 404,
			json: async () => ({ error: "Some error" }),
		});

		const { rerender } = render(
			<DeleteCardModal {...defaultProps} onClose={onClose} />,
		);

		// Trigger error
		await user.click(screen.getByRole("button", { name: "Delete" }));
		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeDefined();
		});

		// Close and reopen the modal
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		rerender(<DeleteCardModal {...defaultProps} onClose={onClose} />);

		// Error should be cleared
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("displays card front correctly when card changes", () => {
		const { rerender } = render(<DeleteCardModal {...defaultProps} />);

		expect(screen.getByText(/"Test Question"/)).toBeDefined();

		const newCard = { id: "card-789", front: "Another Question" };
		rerender(<DeleteCardModal {...defaultProps} card={newCard} />);

		expect(screen.getByText(/"Another Question"/)).toBeDefined();
	});
});
