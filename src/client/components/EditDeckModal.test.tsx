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
import { EditDeckModal } from "./EditDeckModal";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("EditDeckModal", () => {
	const mockDeck = {
		id: "deck-123",
		name: "Test Deck",
		description: "Test description",
		newCardsPerDay: 20,
	};

	const defaultProps = {
		isOpen: true,
		deck: mockDeck,
		onClose: vi.fn(),
		onDeckUpdated: vi.fn(),
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
		render(<EditDeckModal {...defaultProps} isOpen={false} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("does not render when deck is null", () => {
		render(<EditDeckModal {...defaultProps} deck={null} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders modal when open with deck", () => {
		render(<EditDeckModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(screen.getByRole("heading", { name: "Edit Deck" })).toBeDefined();
		expect(screen.getByLabelText("Name")).toBeDefined();
		expect(screen.getByLabelText("Description (optional)")).toBeDefined();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
	});

	it("populates form with deck values", () => {
		render(<EditDeckModal {...defaultProps} />);

		expect(screen.getByLabelText("Name")).toHaveProperty("value", "Test Deck");
		expect(screen.getByLabelText("Description (optional)")).toHaveProperty(
			"value",
			"Test description",
		);
	});

	it("populates form with empty description when deck description is null", () => {
		const deckWithNullDesc = { ...mockDeck, description: null };
		render(<EditDeckModal {...defaultProps} deck={deckWithNullDesc} />);

		expect(screen.getByLabelText("Description (optional)")).toHaveProperty(
			"value",
			"",
		);
	});

	it("disables save button when name is empty", async () => {
		const user = userEvent.setup();
		render(<EditDeckModal {...defaultProps} />);

		const nameInput = screen.getByLabelText("Name");
		await user.clear(nameInput);

		const saveButton = screen.getByRole("button", { name: "Save" });
		expect(saveButton).toHaveProperty("disabled", true);
	});

	it("enables save button when name has content", () => {
		render(<EditDeckModal {...defaultProps} />);

		const saveButton = screen.getByRole("button", { name: "Save" });
		expect(saveButton).toHaveProperty("disabled", false);
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<EditDeckModal {...defaultProps} onClose={onClose} />);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("calls onClose when clicking outside the modal", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<EditDeckModal {...defaultProps} onClose={onClose} />);

		// Click on the backdrop (the dialog element itself)
		const dialog = screen.getByRole("dialog");
		await user.click(dialog);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("does not call onClose when clicking inside the modal content", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<EditDeckModal {...defaultProps} onClose={onClose} />);

		// Click on an element inside the modal
		await user.click(screen.getByLabelText("Name"));

		expect(onClose).not.toHaveBeenCalled();
	});

	it("updates deck with new name", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onDeckUpdated = vi.fn();

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				deck: {
					id: "deck-123",
					name: "Updated Deck",
					description: "Test description",
					newCardsPerDay: 20,
				},
			}),
		});

		render(
			<EditDeckModal
				isOpen={true}
				deck={mockDeck}
				onClose={onClose}
				onDeckUpdated={onDeckUpdated}
			/>,
		);

		const nameInput = screen.getByLabelText("Name");
		await user.clear(nameInput);
		await user.type(nameInput, "Updated Deck");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith("/api/decks/deck-123", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer access-token",
				},
				body: JSON.stringify({
					name: "Updated Deck",
					description: "Test description",
				}),
			});
		});

		expect(onDeckUpdated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("updates deck with new description", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onDeckUpdated = vi.fn();

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				deck: {
					id: "deck-123",
					name: "Test Deck",
					description: "New description",
					newCardsPerDay: 20,
				},
			}),
		});

		render(
			<EditDeckModal
				isOpen={true}
				deck={mockDeck}
				onClose={onClose}
				onDeckUpdated={onDeckUpdated}
			/>,
		);

		const descInput = screen.getByLabelText("Description (optional)");
		await user.clear(descInput);
		await user.type(descInput, "New description");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith("/api/decks/deck-123", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer access-token",
				},
				body: JSON.stringify({
					name: "Test Deck",
					description: "New description",
				}),
			});
		});

		expect(onDeckUpdated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("clears description when input is emptied", async () => {
		const user = userEvent.setup();

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				deck: {
					id: "deck-123",
					name: "Test Deck",
					description: null,
					newCardsPerDay: 20,
				},
			}),
		});

		render(<EditDeckModal {...defaultProps} />);

		const descInput = screen.getByLabelText("Description (optional)");
		await user.clear(descInput);
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith("/api/decks/deck-123", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer access-token",
				},
				body: JSON.stringify({
					name: "Test Deck",
					description: null,
				}),
			});
		});
	});

	it("trims whitespace from name and description", async () => {
		const user = userEvent.setup();

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ deck: { id: "deck-123" } }),
		});

		const deckWithWhitespace = {
			...mockDeck,
			name: "  Deck  ",
			description: "  Description  ",
		};
		render(<EditDeckModal {...defaultProps} deck={deckWithWhitespace} />);

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith("/api/decks/deck-123", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer access-token",
				},
				body: JSON.stringify({
					name: "Deck",
					description: "Description",
				}),
			});
		});
	});

	it("shows loading state during submission", async () => {
		const user = userEvent.setup();

		mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

		render(<EditDeckModal {...defaultProps} />);

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
		expect(screen.getByLabelText("Name")).toHaveProperty("disabled", true);
		expect(screen.getByLabelText("Description (optional)")).toHaveProperty(
			"disabled",
			true,
		);
	});

	it("displays API error message", async () => {
		const user = userEvent.setup();

		mockFetch.mockResolvedValue({
			ok: false,
			status: 400,
			json: async () => ({ error: "Deck name already exists" }),
		});

		render(<EditDeckModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Deck name already exists",
			);
		});
	});

	it("displays generic error on unexpected failure", async () => {
		const user = userEvent.setup();

		mockFetch.mockRejectedValue(new Error("Network error"));

		render(<EditDeckModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to update deck. Please try again.",
			);
		});
	});

	it("displays error when not authenticated", async () => {
		const user = userEvent.setup();

		vi.mocked(apiClient.getAuthHeader).mockReturnValue(undefined);

		render(<EditDeckModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Not authenticated",
			);
		});
	});

	it("updates form when deck prop changes", () => {
		const { rerender } = render(<EditDeckModal {...defaultProps} />);

		expect(screen.getByLabelText("Name")).toHaveProperty("value", "Test Deck");

		const newDeck = {
			...mockDeck,
			name: "New Deck Name",
			description: "New description",
		};
		rerender(<EditDeckModal {...defaultProps} deck={newDeck} />);

		expect(screen.getByLabelText("Name")).toHaveProperty(
			"value",
			"New Deck Name",
		);
		expect(screen.getByLabelText("Description (optional)")).toHaveProperty(
			"value",
			"New description",
		);
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
			<EditDeckModal {...defaultProps} onClose={onClose} />,
		);

		// Trigger error
		await user.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeDefined();
		});

		// Close and reopen the modal
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		rerender(<EditDeckModal {...defaultProps} onClose={onClose} />);

		// Error should be cleared
		expect(screen.queryByRole("alert")).toBeNull();
	});
});
