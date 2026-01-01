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
					":deckId": {
						notes: {
							":noteId": {
								$delete: (args: unknown) => mockDelete(args),
							},
						},
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
import { DeleteNoteModal } from "./DeleteNoteModal";

describe("DeleteNoteModal", () => {
	const defaultProps = {
		isOpen: true,
		deckId: "deck-1",
		noteId: "note-1",
		onClose: vi.fn(),
		onNoteDeleted: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockDelete.mockResolvedValue({ ok: true });
		mockHandleResponse.mockResolvedValue({});
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

		// Click the backdrop (the dialog container)
		const dialog = screen.getByRole("dialog");
		await user.click(dialog);

		expect(onClose).toHaveBeenCalledOnce();
	});

	it("calls onClose when Escape key is pressed on the dialog", async () => {
		const onClose = vi.fn();

		render(<DeleteNoteModal {...defaultProps} onClose={onClose} />);

		// The dialog has onKeyDown handler - fire a keyboard event directly
		const dialog = screen.getByRole("dialog");
		const event = new KeyboardEvent("keydown", {
			key: "Escape",
			bubbles: true,
		});
		dialog.dispatchEvent(event);

		expect(onClose).toHaveBeenCalledOnce();
	});

	it("deletes note and calls callbacks on success", async () => {
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
			expect(mockDelete).toHaveBeenCalledWith({
				param: { deckId: "deck-1", noteId: "note-1" },
			});
		});

		expect(onNoteDeleted).toHaveBeenCalledOnce();
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("displays error message when delete fails", async () => {
		const user = userEvent.setup();

		mockHandleResponse.mockRejectedValue(
			new ApiClientError("Failed to delete note", 500),
		);

		render(<DeleteNoteModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to delete note",
			);
		});
	});

	it("shows Deleting... text while deleting", async () => {
		const user = userEvent.setup();

		// Create a promise that we can control
		mockDelete.mockImplementation(() => new Promise(() => {})); // Never resolves

		render(<DeleteNoteModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		// Should show "Deleting..." while request is in progress
		expect(screen.getByText("Deleting...")).toBeDefined();
	});

	it("disables buttons while deleting", async () => {
		const user = userEvent.setup();

		// Create a promise that we can control
		mockDelete.mockImplementation(() => new Promise(() => {})); // Never resolves

		render(<DeleteNoteModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		// Both buttons should be disabled
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
