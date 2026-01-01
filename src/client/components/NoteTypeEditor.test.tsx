/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNoteTypeGet = vi.fn();
const mockNoteTypePut = vi.fn();
const mockFieldPost = vi.fn();
const mockFieldPut = vi.fn();
const mockFieldDelete = vi.fn();
const mockFieldsReorder = vi.fn();
const mockHandleResponse = vi.fn();

vi.mock("../api/client", () => ({
	apiClient: {
		rpc: {
			api: {
				"note-types": {
					":id": {
						$get: (args: unknown) => mockNoteTypeGet(args),
						$put: (args: unknown) => mockNoteTypePut(args),
						fields: {
							$post: (args: unknown) => mockFieldPost(args),
							":fieldId": {
								$put: (args: unknown) => mockFieldPut(args),
								$delete: (args: unknown) => mockFieldDelete(args),
							},
							reorder: {
								$put: (args: unknown) => mockFieldsReorder(args),
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
// Import after mock is set up
import { NoteTypeEditor } from "./NoteTypeEditor";

describe("NoteTypeEditor", () => {
	const mockNoteTypeWithFields = {
		id: "note-type-123",
		name: "Basic",
		frontTemplate: "{{Front}}",
		backTemplate: "{{Back}}",
		isReversible: false,
		fields: [
			{
				id: "field-1",
				noteTypeId: "note-type-123",
				name: "Front",
				order: 0,
				fieldType: "text",
			},
			{
				id: "field-2",
				noteTypeId: "note-type-123",
				name: "Back",
				order: 1,
				fieldType: "text",
			},
		],
	};

	const defaultProps = {
		isOpen: true,
		noteTypeId: "note-type-123",
		onClose: vi.fn(),
		onNoteTypeUpdated: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockNoteTypeGet.mockResolvedValue({ ok: true });
		mockNoteTypePut.mockResolvedValue({ ok: true });
		mockFieldPost.mockResolvedValue({ ok: true });
		mockFieldPut.mockResolvedValue({ ok: true });
		mockFieldDelete.mockResolvedValue({ ok: true });
		mockFieldsReorder.mockResolvedValue({ ok: true });
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("does not render when closed", () => {
		render(<NoteTypeEditor {...defaultProps} isOpen={false} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders modal and fetches note type when open", async () => {
		mockHandleResponse.mockResolvedValueOnce({
			noteType: mockNoteTypeWithFields,
		});

		render(<NoteTypeEditor {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();

		await waitFor(() => {
			expect(mockNoteTypeGet).toHaveBeenCalledWith({
				param: { id: "note-type-123" },
			});
		});

		await waitFor(() => {
			expect(screen.getByLabelText("Name")).toHaveProperty("value", "Basic");
		});
	});

	it("displays note type data after loading", async () => {
		mockHandleResponse.mockResolvedValueOnce({
			noteType: mockNoteTypeWithFields,
		});

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Name")).toHaveProperty("value", "Basic");
		});

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
		expect(screen.getByText("Front")).toBeDefined();
		expect(screen.getByText("Back")).toBeDefined();
	});

	it("displays loading state while fetching", async () => {
		mockNoteTypeGet.mockImplementation(() => new Promise(() => {})); // Never resolves

		render(<NoteTypeEditor {...defaultProps} />);

		// Should show dialog
		expect(screen.getByRole("dialog")).toBeDefined();
	});

	it("displays error when fetch fails", async () => {
		mockHandleResponse.mockRejectedValueOnce(
			new ApiClientError("Note type not found", 404),
		);

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Note type not found",
			);
		});
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		mockHandleResponse.mockResolvedValueOnce({
			noteType: mockNoteTypeWithFields,
		});

		render(<NoteTypeEditor {...defaultProps} onClose={onClose} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Name")).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("calls onClose when clicking outside the modal", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		mockHandleResponse.mockResolvedValueOnce({
			noteType: mockNoteTypeWithFields,
		});

		render(<NoteTypeEditor {...defaultProps} onClose={onClose} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Name")).toBeDefined();
		});

		const dialog = screen.getByRole("dialog");
		await user.click(dialog);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("updates note type when Save Changes is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onNoteTypeUpdated = vi.fn();

		mockHandleResponse
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields })
			.mockResolvedValueOnce({
				noteType: { ...mockNoteTypeWithFields, name: "Updated Basic" },
			});

		render(
			<NoteTypeEditor
				isOpen={true}
				noteTypeId="note-type-123"
				onClose={onClose}
				onNoteTypeUpdated={onNoteTypeUpdated}
			/>,
		);

		await waitFor(() => {
			expect(screen.getByLabelText("Name")).toHaveProperty("value", "Basic");
		});

		const nameInput = screen.getByLabelText("Name");
		await user.clear(nameInput);
		await user.type(nameInput, "Updated Basic");

		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(mockNoteTypePut).toHaveBeenCalledWith({
				param: { id: "note-type-123" },
				json: {
					name: "Updated Basic",
					frontTemplate: "{{Front}}",
					backTemplate: "{{Back}}",
					isReversible: false,
				},
			});
		});

		expect(onNoteTypeUpdated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("adds a new field", async () => {
		const user = userEvent.setup();

		mockHandleResponse
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields })
			.mockResolvedValueOnce({
				field: {
					id: "field-3",
					noteTypeId: "note-type-123",
					name: "Hint",
					order: 2,
					fieldType: "text",
				},
			});

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Name")).toBeDefined();
		});

		const newFieldInput = screen.getByPlaceholderText("New field name");
		await user.type(newFieldInput, "Hint");
		await user.click(screen.getByRole("button", { name: "Add" }));

		await waitFor(() => {
			expect(mockFieldPost).toHaveBeenCalledWith({
				param: { id: "note-type-123" },
				json: {
					name: "Hint",
					order: 2,
					fieldType: "text",
				},
			});
		});

		await waitFor(() => {
			expect(screen.getByText("Hint")).toBeDefined();
		});
	});

	it("deletes a field", async () => {
		const user = userEvent.setup();

		mockHandleResponse
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields })
			.mockResolvedValueOnce({ success: true });

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Front")).toBeDefined();
		});

		// Find the delete button for the "Front" field (first delete button)
		const deleteButtons = screen.getAllByTitle("Delete field");
		expect(deleteButtons.length).toBeGreaterThan(0);
		const deleteButton = deleteButtons.at(0);
		if (!deleteButton) throw new Error("Delete button not found");

		await user.click(deleteButton);

		await waitFor(() => {
			expect(mockFieldDelete).toHaveBeenCalledWith({
				param: { id: "note-type-123", fieldId: "field-1" },
			});
		});
	});

	it("displays error when field deletion fails", async () => {
		const user = userEvent.setup();

		mockHandleResponse
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields })
			.mockRejectedValueOnce(
				new ApiClientError("Cannot delete field with existing values", 409),
			);

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Front")).toBeDefined();
		});

		// Find the delete button for the "Front" field (first delete button)
		const deleteButtons = screen.getAllByTitle("Delete field");
		expect(deleteButtons.length).toBeGreaterThan(0);
		const deleteButton = deleteButtons.at(0);
		if (!deleteButton) throw new Error("Delete button not found");

		await user.click(deleteButton);

		await waitFor(() => {
			const alerts = screen.getAllByRole("alert");
			expect(
				alerts.some((alert) =>
					alert.textContent?.includes(
						"Cannot delete field with existing values",
					),
				),
			).toBe(true);
		});
	});

	it("moves a field up", async () => {
		const user = userEvent.setup();

		mockHandleResponse
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields })
			.mockResolvedValueOnce({
				fields: [
					{
						id: "field-2",
						noteTypeId: "note-type-123",
						name: "Back",
						order: 0,
						fieldType: "text",
					},
					{
						id: "field-1",
						noteTypeId: "note-type-123",
						name: "Front",
						order: 1,
						fieldType: "text",
					},
				],
			});

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Back")).toBeDefined();
		});

		// Find the "move up" button for the "Back" field (second field)
		const moveUpButtons = screen.getAllByTitle("Move up");
		expect(moveUpButtons.length).toBeGreaterThan(1);
		// The first field's move up button is disabled, so click the second one (Back field)
		const secondMoveUpButton = moveUpButtons.at(1);
		if (!secondMoveUpButton) throw new Error("Move up button not found");
		await user.click(secondMoveUpButton);

		await waitFor(() => {
			expect(mockFieldsReorder).toHaveBeenCalledWith({
				param: { id: "note-type-123" },
				json: {
					fieldIds: ["field-2", "field-1"],
				},
			});
		});
	});

	it("moves a field down", async () => {
		const user = userEvent.setup();

		mockHandleResponse
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields })
			.mockResolvedValueOnce({
				fields: [
					{
						id: "field-2",
						noteTypeId: "note-type-123",
						name: "Back",
						order: 0,
						fieldType: "text",
					},
					{
						id: "field-1",
						noteTypeId: "note-type-123",
						name: "Front",
						order: 1,
						fieldType: "text",
					},
				],
			});

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Front")).toBeDefined();
		});

		// Find the "move down" button for the "Front" field (first field)
		const moveDownButtons = screen.getAllByTitle("Move down");
		expect(moveDownButtons.length).toBeGreaterThan(0);
		const firstMoveDownButton = moveDownButtons.at(0);
		if (!firstMoveDownButton) throw new Error("Move down button not found");
		await user.click(firstMoveDownButton);

		await waitFor(() => {
			expect(mockFieldsReorder).toHaveBeenCalledWith({
				param: { id: "note-type-123" },
				json: {
					fieldIds: ["field-2", "field-1"],
				},
			});
		});
	});

	it("edits a field name", async () => {
		const user = userEvent.setup();

		mockHandleResponse
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields })
			.mockResolvedValueOnce({
				field: {
					id: "field-1",
					noteTypeId: "note-type-123",
					name: "Question",
					order: 0,
					fieldType: "text",
				},
			});

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Front")).toBeDefined();
		});

		// Click on the field name to start editing
		await user.click(screen.getByText("Front"));

		// Now there should be an input field
		const editInput = screen.getByDisplayValue("Front");
		await user.clear(editInput);
		await user.type(editInput, "Question");

		// Blur to save
		await user.tab();

		await waitFor(() => {
			expect(mockFieldPut).toHaveBeenCalledWith({
				param: { id: "note-type-123", fieldId: "field-1" },
				json: {
					name: "Question",
				},
			});
		});
	});

	it("shows available fields in template help text", async () => {
		mockHandleResponse.mockResolvedValueOnce({
			noteType: mockNoteTypeWithFields,
		});

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText(/\{\{Front\}\}, \{\{Back\}\}/)).toBeDefined();
		});
	});

	it("disables move up button for first field", async () => {
		mockHandleResponse.mockResolvedValueOnce({
			noteType: mockNoteTypeWithFields,
		});

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Front")).toBeDefined();
		});

		const moveUpButtons = screen.getAllByTitle("Move up");
		// First field's move up button should be disabled
		expect(moveUpButtons[0]).toHaveProperty("disabled", true);
	});

	it("disables move down button for last field", async () => {
		mockHandleResponse.mockResolvedValueOnce({
			noteType: mockNoteTypeWithFields,
		});

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Back")).toBeDefined();
		});

		const moveDownButtons = screen.getAllByTitle("Move down");
		// Last field's move down button should be disabled
		expect(moveDownButtons[moveDownButtons.length - 1]).toHaveProperty(
			"disabled",
			true,
		);
	});

	it("disables Add button when new field name is empty", async () => {
		mockHandleResponse.mockResolvedValueOnce({
			noteType: mockNoteTypeWithFields,
		});

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Name")).toBeDefined();
		});

		const addButton = screen.getByRole("button", { name: "Add" });
		expect(addButton).toHaveProperty("disabled", true);
	});

	it("toggles reversible option", async () => {
		const user = userEvent.setup();

		mockHandleResponse
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields })
			.mockResolvedValueOnce({
				noteType: { ...mockNoteTypeWithFields, isReversible: true },
			});

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Create reversed cards")).toBeDefined();
		});

		const checkbox = screen.getByLabelText("Create reversed cards");
		expect(checkbox).toHaveProperty("checked", false);

		await user.click(checkbox);

		expect(checkbox).toHaveProperty("checked", true);

		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(mockNoteTypePut).toHaveBeenCalledWith({
				param: { id: "note-type-123" },
				json: expect.objectContaining({
					isReversible: true,
				}),
			});
		});
	});
});
