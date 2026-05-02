/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { atom } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockDelete = vi.fn();
const mockHasNotes = vi.fn();
const mockTriggerSync = vi.fn(() => Promise.resolve(null));

vi.mock("../db/repositories", () => ({
	localNoteTypeRepository: {
		delete: (...args: unknown[]) => mockDelete(...args),
		hasNotes: (...args: unknown[]) => mockHasNotes(...args),
	},
}));

vi.mock("../atoms", () => ({
	syncActionAtom: atom(null, () => mockTriggerSync()),
}));

import { DeleteNoteTypeModal } from "./DeleteNoteTypeModal";

describe("DeleteNoteTypeModal", () => {
	const mockNoteType = {
		id: "note-type-123",
		name: "Basic",
	};

	const defaultProps = {
		isOpen: true,
		noteType: mockNoteType,
		onClose: vi.fn(),
		onNoteTypeDeleted: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockDelete.mockResolvedValue(true);
		mockHasNotes.mockResolvedValue(false);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("does not render when closed", () => {
		render(<DeleteNoteTypeModal {...defaultProps} isOpen={false} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("does not render when noteType is null", () => {
		render(<DeleteNoteTypeModal {...defaultProps} noteType={null} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders modal when open with noteType", () => {
		render(<DeleteNoteTypeModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(
			screen.getByRole("heading", { name: "Delete Note Type" }),
		).toBeDefined();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
	});

	it("displays confirmation message with noteType name", () => {
		render(<DeleteNoteTypeModal {...defaultProps} />);

		expect(screen.getByText(/Are you sure you want to delete/)).toBeDefined();
		expect(screen.getByText("Basic")).toBeDefined();
	});

	it("displays warning about deletion constraints", () => {
		render(<DeleteNoteTypeModal {...defaultProps} />);

		expect(
			screen.getByText(/Note types with existing notes cannot be deleted/),
		).toBeDefined();
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<DeleteNoteTypeModal {...defaultProps} onClose={onClose} />);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("deletes noteType via local repository when Delete is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onNoteTypeDeleted = vi.fn();

		render(
			<DeleteNoteTypeModal
				isOpen={true}
				noteType={mockNoteType}
				onClose={onClose}
				onNoteTypeDeleted={onNoteTypeDeleted}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(mockDelete).toHaveBeenCalledWith("note-type-123");
		});

		expect(onNoteTypeDeleted).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("triggers a background sync after a successful delete", async () => {
		const user = userEvent.setup();

		render(<DeleteNoteTypeModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(mockTriggerSync).toHaveBeenCalled();
		});
	});

	it("blocks deletion when notes still reference the type", async () => {
		const user = userEvent.setup();

		mockHasNotes.mockResolvedValue(true);

		render(<DeleteNoteTypeModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Cannot delete note type with existing notes",
			);
		});
		expect(mockDelete).not.toHaveBeenCalled();
	});

	it("shows loading state during deletion", async () => {
		const user = userEvent.setup();

		mockDelete.mockImplementation(() => new Promise(() => {}));

		render(<DeleteNoteTypeModal {...defaultProps} />);

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

	it("shows an error when the note type no longer exists locally", async () => {
		const user = userEvent.setup();

		mockDelete.mockResolvedValue(false);

		render(<DeleteNoteTypeModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Note type not found.",
			);
		});
	});

	it("displays a generic error when the local write fails", async () => {
		const user = userEvent.setup();

		mockDelete.mockRejectedValue(new Error("disk full"));

		render(<DeleteNoteTypeModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to delete note type. Please try again.",
			);
		});
	});

	it("clears error when modal is closed", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		mockDelete.mockRejectedValueOnce(new Error("Some error"));

		const { rerender } = render(
			<DeleteNoteTypeModal {...defaultProps} onClose={onClose} />,
		);

		await user.click(screen.getByRole("button", { name: "Delete" }));
		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Cancel" }));
		rerender(<DeleteNoteTypeModal {...defaultProps} onClose={onClose} />);

		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("displays noteType name correctly when changed", () => {
		const { rerender } = render(<DeleteNoteTypeModal {...defaultProps} />);

		expect(screen.getByText("Basic")).toBeDefined();

		const newNoteType = { id: "note-type-456", name: "Another Note Type" };
		rerender(<DeleteNoteTypeModal {...defaultProps} noteType={newNoteType} />);

		expect(screen.getByText("Another Note Type")).toBeDefined();
	});
});
