/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { atom } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNoteTypeFindById = vi.fn();
const mockNoteTypeUpdate = vi.fn();
const mockFieldFindByNoteTypeId = vi.fn();
const mockFieldCreate = vi.fn();
const mockFieldUpdate = vi.fn();
const mockFieldDelete = vi.fn();
const mockFieldHasValues = vi.fn();
const mockFieldReorder = vi.fn();
const mockTriggerSync = vi.fn(() => Promise.resolve(null));

vi.mock("../db/repositories", () => ({
	localNoteTypeRepository: {
		findById: (...args: unknown[]) => mockNoteTypeFindById(...args),
		update: (...args: unknown[]) => mockNoteTypeUpdate(...args),
	},
	localNoteFieldTypeRepository: {
		findByNoteTypeId: (...args: unknown[]) =>
			mockFieldFindByNoteTypeId(...args),
		create: (...args: unknown[]) => mockFieldCreate(...args),
		update: (...args: unknown[]) => mockFieldUpdate(...args),
		delete: (...args: unknown[]) => mockFieldDelete(...args),
		hasNoteFieldValues: (...args: unknown[]) => mockFieldHasValues(...args),
		reorder: (...args: unknown[]) => mockFieldReorder(...args),
	},
}));

vi.mock("../atoms", () => ({
	syncActionAtom: atom(null, () => mockTriggerSync()),
}));

import { NoteTypeEditor } from "./NoteTypeEditor";

describe("NoteTypeEditor", () => {
	const noteTypeRow = {
		id: "note-type-123",
		userId: "user-1",
		name: "Basic",
		frontTemplate: "{{Front}}",
		backTemplate: "{{Back}}",
		isReversible: false,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		deletedAt: null,
		syncVersion: 0,
		_synced: true,
	};

	const fieldRows = [
		{
			id: "field-1",
			noteTypeId: "note-type-123",
			name: "Front",
			order: 0,
			fieldType: "text",
			createdAt: new Date("2024-01-01"),
			updatedAt: new Date("2024-01-01"),
			deletedAt: null,
			syncVersion: 0,
			_synced: true,
		},
		{
			id: "field-2",
			noteTypeId: "note-type-123",
			name: "Back",
			order: 1,
			fieldType: "text",
			createdAt: new Date("2024-01-01"),
			updatedAt: new Date("2024-01-01"),
			deletedAt: null,
			syncVersion: 0,
			_synced: true,
		},
	];

	const defaultProps = {
		isOpen: true,
		noteTypeId: "note-type-123",
		onClose: vi.fn(),
		onNoteTypeUpdated: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockNoteTypeFindById.mockResolvedValue(noteTypeRow);
		mockFieldFindByNoteTypeId.mockResolvedValue(fieldRows);
		mockNoteTypeUpdate.mockResolvedValue(noteTypeRow);
		mockFieldCreate.mockImplementation(async (data: { name: string }) => ({
			id: "field-3",
			noteTypeId: "note-type-123",
			name: data.name,
			order: 2,
			fieldType: "text",
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null,
			syncVersion: 0,
			_synced: false,
		}));
		mockFieldUpdate.mockImplementation(
			async (id: string, data: { name?: string }) => ({
				...fieldRows.find((f) => f.id === id),
				...data,
				updatedAt: new Date(),
				_synced: false,
			}),
		);
		mockFieldDelete.mockResolvedValue(true);
		mockFieldHasValues.mockResolvedValue(false);
		mockFieldReorder.mockImplementation(
			async (_noteTypeId: string, ids: string[]) =>
				ids.map((id, i) => ({
					...fieldRows.find((f) => f.id === id),
					order: i,
				})),
		);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("does not render when closed", () => {
		render(<NoteTypeEditor {...defaultProps} isOpen={false} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("loads the note type and fields from the local database when opened", async () => {
		render(<NoteTypeEditor {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();

		await waitFor(() => {
			expect(mockNoteTypeFindById).toHaveBeenCalledWith("note-type-123");
		});

		await waitFor(() => {
			expect(screen.getByLabelText("Name")).toHaveProperty("value", "Basic");
		});
		expect(mockFieldFindByNoteTypeId).toHaveBeenCalledWith("note-type-123");
	});

	it("displays note type data after loading", async () => {
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

	it("displays an error when the note type is missing locally", async () => {
		mockNoteTypeFindById.mockResolvedValueOnce(undefined);

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Note type not found.",
			);
		});
	});

	it("displays an error when the note type is soft-deleted", async () => {
		mockNoteTypeFindById.mockResolvedValueOnce({
			...noteTypeRow,
			deletedAt: new Date(),
		});

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Note type not found.",
			);
		});
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		render(<NoteTypeEditor {...defaultProps} onClose={onClose} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Name")).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("updates the note type when Save Changes is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onNoteTypeUpdated = vi.fn();

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
			expect(mockNoteTypeUpdate).toHaveBeenCalledWith("note-type-123", {
				name: "Updated Basic",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
			});
		});

		expect(onNoteTypeUpdated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
		await waitFor(() => {
			expect(mockTriggerSync).toHaveBeenCalled();
		});
	});

	it("adds a new field via the local repository", async () => {
		const user = userEvent.setup();

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Name")).toBeDefined();
		});

		const newFieldInput = screen.getByPlaceholderText("New field name");
		await user.type(newFieldInput, "Hint");
		await user.click(screen.getByRole("button", { name: "Add" }));

		await waitFor(() => {
			expect(mockFieldCreate).toHaveBeenCalledWith({
				noteTypeId: "note-type-123",
				name: "Hint",
				order: 2,
			});
		});

		await waitFor(() => {
			expect(screen.getByText("Hint")).toBeDefined();
		});
	});

	it("deletes a field via the local repository", async () => {
		const user = userEvent.setup();

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Front")).toBeDefined();
		});

		const deleteButtons = screen.getAllByTitle("Delete field");
		const deleteButton = deleteButtons.at(0);
		if (!deleteButton) throw new Error("Delete button not found");

		await user.click(deleteButton);

		await waitFor(() => {
			expect(mockFieldDelete).toHaveBeenCalledWith("field-1");
		});
	});

	it("blocks deletion when the field still has stored values", async () => {
		const user = userEvent.setup();

		mockFieldHasValues.mockResolvedValue(true);

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Front")).toBeDefined();
		});

		const deleteButtons = screen.getAllByTitle("Delete field");
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
		expect(mockFieldDelete).not.toHaveBeenCalled();
	});

	it("reorders fields when Move up is clicked", async () => {
		const user = userEvent.setup();

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Back")).toBeDefined();
		});

		const moveUpButtons = screen.getAllByTitle("Move up");
		const secondMoveUpButton = moveUpButtons.at(1);
		if (!secondMoveUpButton) throw new Error("Move up button not found");
		await user.click(secondMoveUpButton);

		await waitFor(() => {
			expect(mockFieldReorder).toHaveBeenCalledWith("note-type-123", [
				"field-2",
				"field-1",
			]);
		});
	});

	it("reorders fields when Move down is clicked", async () => {
		const user = userEvent.setup();

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Front")).toBeDefined();
		});

		const moveDownButtons = screen.getAllByTitle("Move down");
		const firstMoveDownButton = moveDownButtons.at(0);
		if (!firstMoveDownButton) throw new Error("Move down button not found");
		await user.click(firstMoveDownButton);

		await waitFor(() => {
			expect(mockFieldReorder).toHaveBeenCalledWith("note-type-123", [
				"field-2",
				"field-1",
			]);
		});
	});

	it("edits a field name via the local repository", async () => {
		const user = userEvent.setup();

		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Front")).toBeDefined();
		});

		await user.click(screen.getByText("Front"));

		const editInput = screen.getByDisplayValue("Front");
		await user.clear(editInput);
		await user.type(editInput, "Question");

		await user.tab();

		await waitFor(() => {
			expect(mockFieldUpdate).toHaveBeenCalledWith("field-1", {
				name: "Question",
			});
		});
	});

	it("shows available fields in template help text", async () => {
		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText(/\{\{Front\}\}, \{\{Back\}\}/)).toBeDefined();
		});
	});

	it("disables move up button for first field", async () => {
		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Front")).toBeDefined();
		});

		const moveUpButtons = screen.getAllByTitle("Move up");
		expect(moveUpButtons[0]).toHaveProperty("disabled", true);
	});

	it("disables move down button for last field", async () => {
		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Back")).toBeDefined();
		});

		const moveDownButtons = screen.getAllByTitle("Move down");
		expect(moveDownButtons[moveDownButtons.length - 1]).toHaveProperty(
			"disabled",
			true,
		);
	});

	it("disables Add button when new field name is empty", async () => {
		render(<NoteTypeEditor {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Name")).toBeDefined();
		});

		const addButton = screen.getByRole("button", { name: "Add" });
		expect(addButton).toHaveProperty("disabled", true);
	});

	it("toggles reversible option and persists it on save", async () => {
		const user = userEvent.setup();

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
			expect(mockNoteTypeUpdate).toHaveBeenCalledWith(
				"note-type-123",
				expect.objectContaining({ isReversible: true }),
			);
		});
	});
});
