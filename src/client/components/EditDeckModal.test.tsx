/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { atom } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUpdate = vi.fn();
const mockTriggerSync = vi.fn(() => Promise.resolve(null));

vi.mock("../db/repositories", () => ({
	localDeckRepository: {
		update: (...args: unknown[]) => mockUpdate(...args),
	},
}));

vi.mock("../atoms", () => ({
	syncActionAtom: atom(null, () => mockTriggerSync()),
	noteTypesAtom: atom({ data: [] as { id: string; name: string }[] }),
}));

import { EditDeckModal } from "./EditDeckModal";

describe("EditDeckModal", () => {
	const mockDeck = {
		id: "deck-123",
		name: "Test Deck",
		description: "Test description",
		defaultNoteTypeId: null as string | null,
	};

	const defaultProps = {
		isOpen: true,
		deck: mockDeck,
		onClose: vi.fn(),
		onDeckUpdated: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockUpdate.mockResolvedValue({
			id: "deck-123",
			userId: "user-1",
			name: "Test Deck",
			description: "Test description",
			defaultNoteTypeId: null,
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
		expect(screen.getByRole("button", { name: "Save Changes" })).toBeDefined();
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

		const saveButton = screen.getByRole("button", { name: "Save Changes" });
		expect(saveButton).toHaveProperty("disabled", true);
	});

	it("enables save button when name has content", () => {
		render(<EditDeckModal {...defaultProps} />);

		const saveButton = screen.getByRole("button", { name: "Save Changes" });
		expect(saveButton).toHaveProperty("disabled", false);
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<EditDeckModal {...defaultProps} onClose={onClose} />);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("updates deck via local repository with new name", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onDeckUpdated = vi.fn();

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
		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(mockUpdate).toHaveBeenCalledWith("deck-123", {
				name: "Updated Deck",
				description: "Test description",
				defaultNoteTypeId: null,
			});
		});

		expect(onDeckUpdated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("clears description when input is emptied", async () => {
		const user = userEvent.setup();

		render(<EditDeckModal {...defaultProps} />);

		const descInput = screen.getByLabelText("Description (optional)");
		await user.clear(descInput);
		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(mockUpdate).toHaveBeenCalledWith("deck-123", {
				name: "Test Deck",
				description: null,
				defaultNoteTypeId: null,
			});
		});
	});

	it("trims whitespace from name and description", async () => {
		const user = userEvent.setup();

		const deckWithWhitespace = {
			...mockDeck,
			name: "  Deck  ",
			description: "  Description  ",
		};
		render(<EditDeckModal {...defaultProps} deck={deckWithWhitespace} />);

		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(mockUpdate).toHaveBeenCalledWith("deck-123", {
				name: "Deck",
				description: "Description",
				defaultNoteTypeId: null,
			});
		});
	});

	it("triggers a background sync after a successful update", async () => {
		const user = userEvent.setup();

		render(<EditDeckModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(mockTriggerSync).toHaveBeenCalled();
		});
	});

	it("shows loading state during submission", async () => {
		const user = userEvent.setup();

		mockUpdate.mockImplementation(() => new Promise(() => {}));

		render(<EditDeckModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Save Changes" }));

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

	it("shows an error when the deck no longer exists locally", async () => {
		const user = userEvent.setup();

		mockUpdate.mockResolvedValue(undefined);

		render(<EditDeckModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Deck not found.",
			);
		});
	});

	it("displays a generic error when the local write fails", async () => {
		const user = userEvent.setup();

		mockUpdate.mockRejectedValue(new Error("disk full"));

		render(<EditDeckModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to update deck. Please try again.",
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

		mockUpdate.mockRejectedValueOnce(new Error("Some error"));

		const { rerender } = render(
			<EditDeckModal {...defaultProps} onClose={onClose} />,
		);

		await user.click(screen.getByRole("button", { name: "Save Changes" }));
		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Cancel" }));
		rerender(<EditDeckModal {...defaultProps} onClose={onClose} />);

		expect(screen.queryByRole("alert")).toBeNull();
	});
});
