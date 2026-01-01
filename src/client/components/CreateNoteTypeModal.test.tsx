/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPost = vi.fn();
const mockHandleResponse = vi.fn();

vi.mock("../api/client", () => ({
	apiClient: {
		rpc: {
			api: {
				"note-types": {
					$post: (args: unknown) => mockPost(args),
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
import { CreateNoteTypeModal } from "./CreateNoteTypeModal";

describe("CreateNoteTypeModal", () => {
	const defaultProps = {
		isOpen: true,
		onClose: vi.fn(),
		onNoteTypeCreated: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockPost.mockResolvedValue({ ok: true });
		mockHandleResponse.mockResolvedValue({
			noteType: {
				id: "note-type-1",
				name: "Test Note Type",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			},
		});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("does not render when closed", () => {
		render(<CreateNoteTypeModal {...defaultProps} isOpen={false} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders modal when open", () => {
		render(<CreateNoteTypeModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(
			screen.getByRole("heading", { name: "Create Note Type" }),
		).toBeDefined();
		expect(screen.getByLabelText("Name")).toBeDefined();
		expect(screen.getByLabelText("Front Template")).toBeDefined();
		expect(screen.getByLabelText("Back Template")).toBeDefined();
		expect(screen.getByLabelText("Create reversed cards")).toBeDefined();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Create" })).toBeDefined();
	});

	it("has default template values", () => {
		render(<CreateNoteTypeModal {...defaultProps} />);

		expect(screen.getByLabelText("Front Template")).toHaveProperty(
			"value",
			"{{Front}}",
		);
		expect(screen.getByLabelText("Back Template")).toHaveProperty(
			"value",
			"{{Back}}",
		);
	});

	it("disables create button when name is empty", () => {
		render(<CreateNoteTypeModal {...defaultProps} />);

		const createButton = screen.getByRole("button", { name: "Create" });
		expect(createButton).toHaveProperty("disabled", true);
	});

	it("enables create button when name has content", async () => {
		const user = userEvent.setup();
		render(<CreateNoteTypeModal {...defaultProps} />);

		const nameInput = screen.getByLabelText("Name");
		await user.type(nameInput, "My Note Type");

		const createButton = screen.getByRole("button", { name: "Create" });
		expect(createButton).toHaveProperty("disabled", false);
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<CreateNoteTypeModal {...defaultProps} onClose={onClose} />);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("calls onClose when clicking outside the modal", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<CreateNoteTypeModal {...defaultProps} onClose={onClose} />);

		const dialog = screen.getByRole("dialog");
		await user.click(dialog);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("creates note type with all fields", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onNoteTypeCreated = vi.fn();

		render(
			<CreateNoteTypeModal
				isOpen={true}
				onClose={onClose}
				onNoteTypeCreated={onNoteTypeCreated}
			/>,
		);

		await user.type(screen.getByLabelText("Name"), "Test Note Type");
		// Keep default templates and just toggle reversible
		await user.click(screen.getByLabelText("Create reversed cards"));
		await user.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(mockPost).toHaveBeenCalledWith({
				json: {
					name: "Test Note Type",
					frontTemplate: "{{Front}}",
					backTemplate: "{{Back}}",
					isReversible: true,
				},
			});
		});

		expect(onNoteTypeCreated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("trims whitespace from text fields", async () => {
		const user = userEvent.setup();

		render(<CreateNoteTypeModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "  Test Note Type  ");
		await user.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(mockPost).toHaveBeenCalledWith({
				json: expect.objectContaining({
					name: "Test Note Type",
				}),
			});
		});
	});

	it("shows loading state during submission", async () => {
		const user = userEvent.setup();

		mockPost.mockImplementation(() => new Promise(() => {})); // Never resolves

		render(<CreateNoteTypeModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "Test Note Type");
		await user.click(screen.getByRole("button", { name: "Create" }));

		expect(screen.getByRole("button", { name: "Creating..." })).toBeDefined();
		expect(screen.getByRole("button", { name: "Creating..." })).toHaveProperty(
			"disabled",
			true,
		);
		expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty(
			"disabled",
			true,
		);
		expect(screen.getByLabelText("Name")).toHaveProperty("disabled", true);
	});

	it("displays API error message", async () => {
		const user = userEvent.setup();

		mockHandleResponse.mockRejectedValue(
			new ApiClientError("Note type name already exists", 400),
		);

		render(<CreateNoteTypeModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "Test Note Type");
		await user.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Note type name already exists",
			);
		});
	});

	it("displays generic error on unexpected failure", async () => {
		const user = userEvent.setup();

		mockPost.mockRejectedValue(new Error("Network error"));

		render(<CreateNoteTypeModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "Test Note Type");
		await user.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to create note type. Please try again.",
			);
		});
	});

	it("resets form when closed and reopened", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		const { rerender } = render(
			<CreateNoteTypeModal
				isOpen={true}
				onClose={onClose}
				onNoteTypeCreated={vi.fn()}
			/>,
		);

		// Type something in the form
		await user.type(screen.getByLabelText("Name"), "Test Note Type");
		await user.click(screen.getByLabelText("Create reversed cards"));

		// Click cancel to close
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		// Reopen the modal
		rerender(
			<CreateNoteTypeModal
				isOpen={true}
				onClose={onClose}
				onNoteTypeCreated={vi.fn()}
			/>,
		);

		// Form should be reset
		expect(screen.getByLabelText("Name")).toHaveProperty("value", "");
		expect(screen.getByLabelText("Front Template")).toHaveProperty(
			"value",
			"{{Front}}",
		);
		expect(screen.getByLabelText("Back Template")).toHaveProperty(
			"value",
			"{{Back}}",
		);
		expect(screen.getByLabelText("Create reversed cards")).toHaveProperty(
			"checked",
			false,
		);
	});
});
