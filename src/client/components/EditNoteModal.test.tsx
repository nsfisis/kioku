/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { atom } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNoteFindById = vi.fn();
const mockNoteFieldValueFindByNoteId = vi.fn();
const mockNoteTypeFindById = vi.fn();
const mockNoteFieldTypeFindByNoteTypeId = vi.fn();
const mockUpdateWithFieldValues = vi.fn();
const mockTriggerSync = vi.fn(() => Promise.resolve(null));

vi.mock("../db/repositories", () => ({
	localNoteRepository: {
		findById: (...args: unknown[]) => mockNoteFindById(...args),
		updateWithFieldValues: (...args: unknown[]) =>
			mockUpdateWithFieldValues(...args),
	},
	localNoteFieldValueRepository: {
		findByNoteId: (...args: unknown[]) =>
			mockNoteFieldValueFindByNoteId(...args),
	},
	localNoteTypeRepository: {
		findById: (...args: unknown[]) => mockNoteTypeFindById(...args),
	},
	localNoteFieldTypeRepository: {
		findByNoteTypeId: (...args: unknown[]) =>
			mockNoteFieldTypeFindByNoteTypeId(...args),
	},
}));

vi.mock("../atoms", () => ({
	syncActionAtom: atom(null, () => mockTriggerSync()),
}));

import { EditNoteModal } from "./EditNoteModal";

describe("EditNoteModal", () => {
	const defaultProps = {
		isOpen: true,
		deckId: "deck-123",
		noteId: "note-456",
		onClose: vi.fn(),
		onNoteUpdated: vi.fn(),
	};

	const mockNote = {
		id: "note-456",
		deckId: "deck-123",
		noteTypeId: "note-type-1",
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		syncVersion: 0,
		_synced: true,
	};

	const mockFieldValues = [
		{
			id: "fv-1",
			noteId: "note-456",
			noteFieldTypeId: "field-1",
			value: "Existing front",
			createdAt: new Date(),
			updatedAt: new Date(),
			syncVersion: 0,
			_synced: true,
		},
		{
			id: "fv-2",
			noteId: "note-456",
			noteFieldTypeId: "field-2",
			value: "Existing back",
			createdAt: new Date(),
			updatedAt: new Date(),
			syncVersion: 0,
			_synced: true,
		},
	];

	const mockNoteType = {
		id: "note-type-1",
		userId: "user-1",
		name: "Basic",
		frontTemplate: "{{Front}}",
		backTemplate: "{{Back}}",
		isReversible: false,
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		syncVersion: 0,
		_synced: true,
	};

	const mockFieldTypes = [
		{
			id: "field-1",
			noteTypeId: "note-type-1",
			name: "Front",
			order: 0,
			fieldType: "text",
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null,
			syncVersion: 0,
			_synced: true,
		},
		{
			id: "field-2",
			noteTypeId: "note-type-1",
			name: "Back",
			order: 1,
			fieldType: "text",
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null,
			syncVersion: 0,
			_synced: true,
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		mockNoteFindById.mockResolvedValue(mockNote);
		mockNoteFieldValueFindByNoteId.mockResolvedValue(mockFieldValues);
		mockNoteTypeFindById.mockResolvedValue(mockNoteType);
		mockNoteFieldTypeFindByNoteTypeId.mockResolvedValue(mockFieldTypes);
		mockUpdateWithFieldValues.mockResolvedValue({
			note: mockNote,
			fieldValues: mockFieldValues,
		});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("does not render when closed", () => {
		render(<EditNoteModal {...defaultProps} isOpen={false} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("does not render when noteId is null", () => {
		render(<EditNoteModal {...defaultProps} noteId={null} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders modal when open with noteId", async () => {
		render(<EditNoteModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(screen.getByRole("heading", { name: "Edit Note" })).toBeDefined();

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});
	});

	it("loads note and note type from local repositories", async () => {
		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(mockNoteFindById).toHaveBeenCalledWith("note-456");
		});

		await waitFor(() => {
			expect(mockNoteTypeFindById).toHaveBeenCalledWith("note-type-1");
			expect(mockNoteFieldTypeFindByNoteTypeId).toHaveBeenCalledWith(
				"note-type-1",
			);
			expect(mockNoteFieldValueFindByNoteId).toHaveBeenCalledWith("note-456");
		});
	});

	it("populates form with note field values", async () => {
		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toHaveProperty(
				"value",
				"Existing front",
			);
			expect(screen.getByLabelText("Back")).toHaveProperty(
				"value",
				"Existing back",
			);
		});
	});

	it("displays note type name (read-only)", async () => {
		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Basic")).toBeDefined();
		});
	});

	it("disables save button when fields are empty", async () => {
		const user = userEvent.setup();

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		const frontInput = screen.getByLabelText("Front");
		await user.clear(frontInput);

		const saveButton = screen.getByRole("button", { name: "Save Changes" });
		expect(saveButton).toHaveProperty("disabled", true);
	});

	it("enables save button when all fields have values", async () => {
		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		const saveButton = screen.getByRole("button", { name: "Save Changes" });
		expect(saveButton).toHaveProperty("disabled", false);
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		render(<EditNoteModal {...defaultProps} onClose={onClose} />);

		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("updates note via local repository", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onNoteUpdated = vi.fn();

		render(
			<EditNoteModal
				isOpen={true}
				deckId="deck-123"
				noteId="note-456"
				onClose={onClose}
				onNoteUpdated={onNoteUpdated}
			/>,
		);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		const frontInput = screen.getByLabelText("Front");
		await user.clear(frontInput);
		await user.type(frontInput, "Updated front");
		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(mockUpdateWithFieldValues).toHaveBeenCalledWith("note-456", {
				"field-1": "Updated front",
				"field-2": "Existing back",
			});
		});

		expect(onNoteUpdated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("trims whitespace from field values", async () => {
		const user = userEvent.setup();

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		const frontInput = screen.getByLabelText("Front");
		await user.clear(frontInput);
		await user.type(frontInput, "  Trimmed  ");
		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(mockUpdateWithFieldValues).toHaveBeenCalledWith("note-456", {
				"field-1": "Trimmed",
				"field-2": "Existing back",
			});
		});
	});

	it("triggers a background sync after a successful update", async () => {
		const user = userEvent.setup();

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(mockTriggerSync).toHaveBeenCalled();
		});
	});

	it("shows loading state during fetch", () => {
		mockNoteFindById.mockImplementationOnce(() => new Promise(() => {}));

		render(<EditNoteModal {...defaultProps} />);

		expect(screen.getByText("Loading note...")).toBeDefined();
	});

	it("shows loading state during submission", async () => {
		const user = userEvent.setup();

		mockUpdateWithFieldValues.mockImplementationOnce(
			() => new Promise(() => {}),
		);

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		expect(screen.getByRole("button", { name: "Saving..." })).toBeDefined();
		expect(screen.getByRole("button", { name: "Saving..." })).toHaveProperty(
			"disabled",
			true,
		);
	});

	it("shows an error when the note no longer exists locally", async () => {
		mockNoteFindById.mockResolvedValueOnce(undefined);

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to load note. Please try again.",
			);
		});
	});

	it("shows an error when the note belongs to a different deck", async () => {
		mockNoteFindById.mockResolvedValueOnce({
			...mockNote,
			deckId: "deck-other",
		});

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to load note. Please try again.",
			);
		});
	});

	it("shows an error when the note type fails to load", async () => {
		mockNoteTypeFindById.mockResolvedValueOnce(undefined);

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to load note type details. Please try again.",
			);
		});
	});

	it("displays a generic error when the local write fails", async () => {
		const user = userEvent.setup();

		mockUpdateWithFieldValues.mockRejectedValueOnce(new Error("disk full"));

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to update note. Please try again.",
			);
		});
	});

	it("displays generic error on unexpected fetch failure", async () => {
		mockNoteFindById.mockRejectedValueOnce(new Error("Network error"));

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to load note. Please try again.",
			);
		});
	});

	it("shows reversed indicator for reversible note type", async () => {
		mockNoteTypeFindById.mockResolvedValueOnce({
			...mockNoteType,
			isReversible: true,
		});

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Basic (reversed)")).toBeDefined();
		});
	});
});
