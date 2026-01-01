/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPut = vi.fn();
const mockHandleResponse = vi.fn();

vi.mock("../api/client", () => ({
	apiClient: {
		rpc: {
			api: {
				"note-types": {
					":id": {
						$put: (args: unknown) => mockPut(args),
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
import { EditNoteTypeModal } from "./EditNoteTypeModal";

describe("EditNoteTypeModal", () => {
	const mockNoteType = {
		id: "note-type-123",
		name: "Basic",
		frontTemplate: "{{Front}}",
		backTemplate: "{{Back}}",
		isReversible: false,
	};

	const defaultProps = {
		isOpen: true,
		noteType: mockNoteType,
		onClose: vi.fn(),
		onNoteTypeUpdated: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockPut.mockResolvedValue({ ok: true });
		mockHandleResponse.mockResolvedValue({ noteType: mockNoteType });
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("does not render when closed", () => {
		render(<EditNoteTypeModal {...defaultProps} isOpen={false} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("does not render when noteType is null", () => {
		render(<EditNoteTypeModal {...defaultProps} noteType={null} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders modal when open with noteType", () => {
		render(<EditNoteTypeModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(
			screen.getByRole("heading", { name: "Edit Note Type" }),
		).toBeDefined();
		expect(screen.getByLabelText("Name")).toBeDefined();
		expect(screen.getByLabelText("Front Template")).toBeDefined();
		expect(screen.getByLabelText("Back Template")).toBeDefined();
		expect(screen.getByLabelText("Create reversed cards")).toBeDefined();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Save Changes" })).toBeDefined();
	});

	it("populates form with noteType data", () => {
		render(<EditNoteTypeModal {...defaultProps} />);

		expect(screen.getByLabelText("Name")).toHaveProperty("value", "Basic");
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

	it("populates form with reversible noteType", () => {
		const reversibleNoteType = {
			...mockNoteType,
			isReversible: true,
		};

		render(
			<EditNoteTypeModal {...defaultProps} noteType={reversibleNoteType} />,
		);

		expect(screen.getByLabelText("Create reversed cards")).toHaveProperty(
			"checked",
			true,
		);
	});

	it("disables save button when name is empty", async () => {
		const user = userEvent.setup();
		render(<EditNoteTypeModal {...defaultProps} />);

		const nameInput = screen.getByLabelText("Name");
		await user.clear(nameInput);

		const saveButton = screen.getByRole("button", { name: "Save Changes" });
		expect(saveButton).toHaveProperty("disabled", true);
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<EditNoteTypeModal {...defaultProps} onClose={onClose} />);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("calls onClose when clicking outside the modal", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<EditNoteTypeModal {...defaultProps} onClose={onClose} />);

		const dialog = screen.getByRole("dialog");
		await user.click(dialog);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("updates noteType when Save Changes is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onNoteTypeUpdated = vi.fn();

		render(
			<EditNoteTypeModal
				isOpen={true}
				noteType={mockNoteType}
				onClose={onClose}
				onNoteTypeUpdated={onNoteTypeUpdated}
			/>,
		);

		// Update fields
		const nameInput = screen.getByLabelText("Name");
		await user.clear(nameInput);
		await user.type(nameInput, "Updated Basic");
		await user.click(screen.getByLabelText("Create reversed cards"));

		// Save
		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(mockPut).toHaveBeenCalledWith({
				param: { id: "note-type-123" },
				json: {
					name: "Updated Basic",
					frontTemplate: "{{Front}}",
					backTemplate: "{{Back}}",
					isReversible: true,
				},
			});
		});

		expect(onNoteTypeUpdated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("trims whitespace from text fields", async () => {
		const user = userEvent.setup();

		render(<EditNoteTypeModal {...defaultProps} />);

		const nameInput = screen.getByLabelText("Name");
		await user.clear(nameInput);
		await user.type(nameInput, "  Updated Basic  ");
		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(mockPut).toHaveBeenCalledWith({
				param: { id: "note-type-123" },
				json: expect.objectContaining({
					name: "Updated Basic",
				}),
			});
		});
	});

	it("shows loading state during submission", async () => {
		const user = userEvent.setup();

		mockPut.mockImplementation(() => new Promise(() => {})); // Never resolves

		render(<EditNoteTypeModal {...defaultProps} />);

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
	});

	it("displays API error message", async () => {
		const user = userEvent.setup();

		mockHandleResponse.mockRejectedValue(
			new ApiClientError("Note type not found", 404),
		);

		render(<EditNoteTypeModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Note type not found",
			);
		});
	});

	it("displays generic error on unexpected failure", async () => {
		const user = userEvent.setup();

		mockPut.mockRejectedValue(new Error("Network error"));

		render(<EditNoteTypeModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to update note type. Please try again.",
			);
		});
	});

	it("displays error when handleResponse throws", async () => {
		const user = userEvent.setup();

		mockHandleResponse.mockRejectedValue(
			new ApiClientError("Not authenticated", 401),
		);

		render(<EditNoteTypeModal {...defaultProps} />);

		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Not authenticated",
			);
		});
	});

	it("updates form when noteType prop changes", () => {
		const { rerender } = render(<EditNoteTypeModal {...defaultProps} />);

		expect(screen.getByLabelText("Name")).toHaveProperty("value", "Basic");

		const newNoteType = {
			id: "note-type-456",
			name: "Another Note Type",
			frontTemplate: "Q: {{Front}}",
			backTemplate: "A: {{Back}}",
			isReversible: true,
		};

		rerender(<EditNoteTypeModal {...defaultProps} noteType={newNoteType} />);

		expect(screen.getByLabelText("Name")).toHaveProperty(
			"value",
			"Another Note Type",
		);
		expect(screen.getByLabelText("Front Template")).toHaveProperty(
			"value",
			"Q: {{Front}}",
		);
		expect(screen.getByLabelText("Back Template")).toHaveProperty(
			"value",
			"A: {{Back}}",
		);
		expect(screen.getByLabelText("Create reversed cards")).toHaveProperty(
			"checked",
			true,
		);
	});

	it("clears error when modal is closed", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		mockHandleResponse.mockRejectedValue(new ApiClientError("Some error", 404));

		const { rerender } = render(
			<EditNoteTypeModal {...defaultProps} onClose={onClose} />,
		);

		// Trigger error
		await user.click(screen.getByRole("button", { name: "Save Changes" }));
		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeDefined();
		});

		// Close and reopen the modal
		await user.click(screen.getByRole("button", { name: "Cancel" }));
		rerender(<EditNoteTypeModal {...defaultProps} onClose={onClose} />);

		// Error should be cleared
		expect(screen.queryByRole("alert")).toBeNull();
	});
});
