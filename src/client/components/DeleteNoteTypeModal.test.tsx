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
import { DeleteNoteTypeModal } from "./DeleteNoteTypeModal";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

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
		vi.mocked(apiClient.getAuthHeader).mockReturnValue({
			Authorization: "Bearer access-token",
		});
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

	it("calls onClose when clicking outside the modal", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<DeleteNoteTypeModal {...defaultProps} onClose={onClose} />);

		const dialog = screen.getByRole("dialog");
		await user.click(dialog);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("does not call onClose when clicking inside the modal content", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<DeleteNoteTypeModal {...defaultProps} onClose={onClose} />);

		await user.click(screen.getByText("Basic"));

		expect(onClose).not.toHaveBeenCalled();
	});

	it("deletes noteType when Delete is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onNoteTypeDeleted = vi.fn();

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ success: true }),
		});

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
			expect(mockFetch).toHaveBeenCalledWith("/api/note-types/note-type-123", {
				method: "DELETE",
				headers: {
					Authorization: "Bearer access-token",
				},
			});
		});

		expect(onNoteTypeDeleted).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("shows loading state during deletion", async () => {
		const user = userEvent.setup();

		mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

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

	it("displays API error message", async () => {
		const user = userEvent.setup();

		mockFetch.mockResolvedValue({
			ok: false,
			status: 404,
			json: async () => ({ error: "Note type not found" }),
		});

		render(<DeleteNoteTypeModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Note type not found",
			);
		});
	});

	it("displays conflict error when notes exist", async () => {
		const user = userEvent.setup();

		mockFetch.mockResolvedValue({
			ok: false,
			status: 409,
			json: async () => ({
				error: "Cannot delete note type with existing notes",
			}),
		});

		render(<DeleteNoteTypeModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Cannot delete note type with existing notes",
			);
		});
	});

	it("displays generic error on unexpected failure", async () => {
		const user = userEvent.setup();

		mockFetch.mockRejectedValue(new Error("Network error"));

		render(<DeleteNoteTypeModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to delete note type. Please try again.",
			);
		});
	});

	it("displays error when not authenticated", async () => {
		const user = userEvent.setup();

		vi.mocked(apiClient.getAuthHeader).mockReturnValue(undefined);

		render(<DeleteNoteTypeModal {...defaultProps} />);

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
			<DeleteNoteTypeModal {...defaultProps} onClose={onClose} />,
		);

		// Trigger error
		await user.click(screen.getByRole("button", { name: "Delete" }));
		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeDefined();
		});

		// Close and reopen the modal
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		rerender(<DeleteNoteTypeModal {...defaultProps} onClose={onClose} />);

		// Error should be cleared
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
