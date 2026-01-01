/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockDelete = vi.fn();
const mockHandleResponse = vi.fn();

vi.mock("../api/client", () => ({
	apiClient: {
		rpc: {
			api: {
				decks: {
					":id": {
						$delete: (args: unknown) => mockDelete(args),
					},
				},
			},
		},
		handleResponse: (res: unknown) => mockHandleResponse(res),
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

import { ApiClientError } from "../api/client";
// Import after mock is set up
import { DeleteDeckModal } from "./DeleteDeckModal";

describe("DeleteDeckModal", () => {
	const mockDeck = {
		id: "deck-123",
		name: "Test Deck",
	};

	const defaultProps = {
		isOpen: true,
		deck: mockDeck,
		onClose: vi.fn(),
		onDeckDeleted: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockDelete.mockResolvedValue({ ok: true });
		mockHandleResponse.mockResolvedValue({});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("does not render when closed", () => {
		render(<DeleteDeckModal {...defaultProps} isOpen={false} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("does not render when deck is null", () => {
		render(<DeleteDeckModal {...defaultProps} deck={null} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders modal when open with deck", () => {
		render(<DeleteDeckModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(screen.getByRole("heading", { name: "Delete Deck" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
	});

	it("displays confirmation message with deck name", () => {
		render(<DeleteDeckModal {...defaultProps} />);

		expect(screen.getByText(/Are you sure you want to delete/)).toBeDefined();
		expect(screen.getByText("Test Deck")).toBeDefined();
	});

	it("displays warning about permanent deletion", () => {
		render(<DeleteDeckModal {...defaultProps} />);

		expect(screen.getByText(/This action cannot be undone/)).toBeDefined();
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<DeleteDeckModal {...defaultProps} onClose={onClose} />);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("calls onClose when clicking outside the modal", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<DeleteDeckModal {...defaultProps} onClose={onClose} />);

		// Click on the backdrop (the dialog element itself)
		const dialog = screen.getByRole("dialog");
		await user.click(dialog);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("does not call onClose when clicking inside the modal content", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<DeleteDeckModal {...defaultProps} onClose={onClose} />);

		// Click on an element inside the modal
		await user.click(screen.getByText("Test Deck"));

		expect(onClose).not.toHaveBeenCalled();
	});

	it("deletes deck when Delete is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onDeckDeleted = vi.fn();

		render(
			<DeleteDeckModal
				isOpen={true}
				deck={mockDeck}
				onClose={onClose}
				onDeckDeleted={onDeckDeleted}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(mockDelete).toHaveBeenCalledWith({
				param: { id: "deck-123" },
			});
		});

		expect(onDeckDeleted).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("shows loading state during deletion", async () => {
		const user = userEvent.setup();

		mockDelete.mockImplementation(() => new Promise(() => {})); // Never resolves

		render(<DeleteDeckModal {...defaultProps} />);

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

		mockHandleResponse.mockRejectedValue(
			new ApiClientError("Deck not found", 404),
		);

		render(<DeleteDeckModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain("Deck not found");
		});
	});

	it("displays generic error on unexpected failure", async () => {
		const user = userEvent.setup();

		mockDelete.mockRejectedValue(new Error("Network error"));

		render(<DeleteDeckModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to delete deck. Please try again.",
			);
		});
	});

	it("displays error when handleResponse throws", async () => {
		const user = userEvent.setup();

		mockHandleResponse.mockRejectedValue(
			new ApiClientError("Not authenticated", 401),
		);

		render(<DeleteDeckModal {...defaultProps} />);

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

		mockHandleResponse.mockRejectedValue(new ApiClientError("Some error", 404));

		const { rerender } = render(
			<DeleteDeckModal {...defaultProps} onClose={onClose} />,
		);

		// Trigger error
		await user.click(screen.getByRole("button", { name: "Delete" }));
		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeDefined();
		});

		// Close and reopen the modal
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		rerender(<DeleteDeckModal {...defaultProps} onClose={onClose} />);

		// Error should be cleared
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("displays deck name correctly when changed", () => {
		const { rerender } = render(<DeleteDeckModal {...defaultProps} />);

		expect(screen.getByText("Test Deck")).toBeDefined();

		const newDeck = { id: "deck-456", name: "Another Deck" };
		rerender(<DeleteDeckModal {...defaultProps} deck={newDeck} />);

		expect(screen.getByText("Another Deck")).toBeDefined();
	});
});
