/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { atom } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockDelete = vi.fn();
const mockTriggerSync = vi.fn(() => Promise.resolve(null));

vi.mock("../db/repositories", () => ({
	localDeckRepository: {
		delete: (...args: unknown[]) => mockDelete(...args),
	},
}));

vi.mock("../atoms", () => ({
	syncActionAtom: atom(null, () => mockTriggerSync()),
}));

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
		mockDelete.mockResolvedValue(true);
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

	it("deletes deck via local repository when Delete is clicked", async () => {
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
			expect(mockDelete).toHaveBeenCalledWith("deck-123");
		});

		expect(onDeckDeleted).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("triggers a background sync after a successful delete", async () => {
		const user = userEvent.setup();

		render(<DeleteDeckModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(mockTriggerSync).toHaveBeenCalled();
		});
	});

	it("shows loading state during deletion", async () => {
		const user = userEvent.setup();

		mockDelete.mockImplementation(() => new Promise(() => {}));

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

	it("shows an error when the deck no longer exists locally", async () => {
		const user = userEvent.setup();

		mockDelete.mockResolvedValue(false);

		render(<DeleteDeckModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Deck not found.",
			);
		});
	});

	it("displays a generic error when the local write fails", async () => {
		const user = userEvent.setup();

		mockDelete.mockRejectedValue(new Error("disk full"));

		render(<DeleteDeckModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to delete deck. Please try again.",
			);
		});
	});

	it("clears error when modal is closed", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		mockDelete.mockRejectedValueOnce(new Error("Some error"));

		const { rerender } = render(
			<DeleteDeckModal {...defaultProps} onClose={onClose} />,
		);

		await user.click(screen.getByRole("button", { name: "Delete" }));
		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Cancel" }));
		rerender(<DeleteDeckModal {...defaultProps} onClose={onClose} />);

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
