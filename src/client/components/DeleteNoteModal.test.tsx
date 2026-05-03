/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { atom } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNoteFindById = vi.fn();
const mockNoteDelete = vi.fn();
const mockTriggerSync = vi.fn(() => Promise.resolve(null));

vi.mock("../db/repositories", () => ({
	localNoteRepository: {
		findById: (...args: unknown[]) => mockNoteFindById(...args),
		delete: (...args: unknown[]) => mockNoteDelete(...args),
	},
}));

vi.mock("../atoms", () => ({
	syncActionAtom: atom(null, () => mockTriggerSync()),
}));

import { DeleteNoteModal } from "./DeleteNoteModal";

describe("DeleteNoteModal", () => {
	const defaultProps = {
		isOpen: true,
		deckId: "deck-1",
		noteId: "note-1",
		onClose: vi.fn(),
		onNoteDeleted: vi.fn(),
	};

	const mockNote = {
		id: "note-1",
		deckId: "deck-1",
		noteTypeId: "note-type-1",
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		syncVersion: 0,
		_synced: true,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockNoteFindById.mockResolvedValue(mockNote);
		mockNoteDelete.mockResolvedValue(true);
	});

	afterEach(() => {
		cleanup();
	});

	it("renders delete confirmation dialog", () => {
		render(<DeleteNoteModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(screen.getByRole("heading", { name: "Delete Note" })).toBeDefined();
		expect(
			screen.getByText("Are you sure you want to delete this note?"),
		).toBeDefined();
		expect(
			screen.getByText(
				"This will delete all cards generated from this note. This action cannot be undone.",
			),
		).toBeDefined();
	});

	it("renders Cancel and Delete buttons", () => {
		render(<DeleteNoteModal {...defaultProps} />);

		expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
	});

	it("does not render when isOpen is false", () => {
		render(<DeleteNoteModal {...defaultProps} isOpen={false} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("does not render when noteId is null", () => {
		render(<DeleteNoteModal {...defaultProps} noteId={null} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("calls onClose when Cancel button is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		render(<DeleteNoteModal {...defaultProps} onClose={onClose} />);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledOnce();
	});

	it("calls onClose when backdrop is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		render(<DeleteNoteModal {...defaultProps} onClose={onClose} />);

		const dialog = screen.getByRole("dialog");
		await user.click(dialog);

		expect(onClose).toHaveBeenCalledOnce();
	});

	it("calls onClose when Escape key is pressed on the dialog", async () => {
		const onClose = vi.fn();

		render(<DeleteNoteModal {...defaultProps} onClose={onClose} />);

		const dialog = screen.getByRole("dialog");
		const event = new KeyboardEvent("keydown", {
			key: "Escape",
			bubbles: true,
		});
		dialog.dispatchEvent(event);

		expect(onClose).toHaveBeenCalledOnce();
	});

	it("deletes note via local repository on success", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onNoteDeleted = vi.fn();

		render(
			<DeleteNoteModal
				{...defaultProps}
				onClose={onClose}
				onNoteDeleted={onNoteDeleted}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(mockNoteDelete).toHaveBeenCalledWith("note-1");
		});

		expect(onNoteDeleted).toHaveBeenCalledOnce();
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("triggers a background sync after a successful delete", async () => {
		const user = userEvent.setup();

		render(<DeleteNoteModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(mockTriggerSync).toHaveBeenCalled();
		});
	});

	it("shows an error when the note no longer exists", async () => {
		const user = userEvent.setup();

		mockNoteFindById.mockResolvedValueOnce(undefined);

		render(<DeleteNoteModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Note not found.",
			);
		});
		expect(mockNoteDelete).not.toHaveBeenCalled();
	});

	it("shows an error when the note belongs to a different deck", async () => {
		const user = userEvent.setup();

		mockNoteFindById.mockResolvedValueOnce({
			...mockNote,
			deckId: "deck-other",
		});

		render(<DeleteNoteModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Note not found.",
			);
		});
		expect(mockNoteDelete).not.toHaveBeenCalled();
	});

	it("displays a generic error when the local write fails", async () => {
		const user = userEvent.setup();

		mockNoteDelete.mockRejectedValueOnce(new Error("disk full"));

		render(<DeleteNoteModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to delete note. Please try again.",
			);
		});
	});

	it("shows Deleting... text while deleting", async () => {
		const user = userEvent.setup();

		mockNoteDelete.mockImplementation(() => new Promise(() => {}));

		render(<DeleteNoteModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByText("Deleting...")).toBeDefined();
		});
	});

	it("disables buttons while deleting", async () => {
		const user = userEvent.setup();

		mockNoteDelete.mockImplementation(() => new Promise(() => {}));

		render(<DeleteNoteModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByText("Deleting...")).toBeDefined();
		});

		expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty(
			"disabled",
			true,
		);
		expect(screen.getByText("Deleting...").closest("button")).toHaveProperty(
			"disabled",
			true,
		);
	});
});
