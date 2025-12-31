/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../api/client";
import { DeleteNoteModal } from "./DeleteNoteModal";

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

const mockFetch = vi.fn();
global.fetch = mockFetch;

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
		vi.mocked(apiClient.getAuthHeader).mockReturnValue({
			Authorization: "Bearer access-token",
		});
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

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ success: true }),
		});

		render(
			<DeleteNoteModal
				{...defaultProps}
				onClose={onClose}
				onNoteDeleted={onNoteDeleted}
			/>,
		);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith("/api/decks/deck-1/notes/note-1", {
				method: "DELETE",
				headers: { Authorization: "Bearer access-token" },
			});
		});

		expect(onNoteDeleted).toHaveBeenCalledOnce();
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("displays error message when delete fails", async () => {
		const user = userEvent.setup();

		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: async () => ({ error: "Failed to delete note" }),
		});

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
		let resolveDelete: ((value: unknown) => void) | undefined;
		const deletePromise = new Promise((resolve) => {
			resolveDelete = resolve;
		});

		mockFetch.mockReturnValueOnce(deletePromise);

		render(<DeleteNoteModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		// Should show "Deleting..." while request is in progress
		expect(screen.getByText("Deleting...")).toBeDefined();

		// Resolve the delete request to cleanup
		resolveDelete?.({
			ok: true,
			json: async () => ({ success: true }),
		});
	});

	it("disables buttons while deleting", async () => {
		const user = userEvent.setup();

		// Create a promise that we can control
		let resolveDelete: ((value: unknown) => void) | undefined;
		const deletePromise = new Promise((resolve) => {
			resolveDelete = resolve;
		});

		mockFetch.mockReturnValueOnce(deletePromise);

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

		// Resolve the delete request to cleanup
		resolveDelete?.({
			ok: true,
			json: async () => ({ success: true }),
		});
	});
});
