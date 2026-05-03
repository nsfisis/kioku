/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { atom } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNoteTypeFindByUserId = vi.fn();
const mockNoteTypeFindById = vi.fn();
const mockNoteFieldTypeFindByNoteTypeId = vi.fn();
const mockCreateWithCards = vi.fn();
const mockTriggerSync = vi.fn(() => Promise.resolve(null));

vi.mock("../db/repositories", () => ({
	localNoteTypeRepository: {
		findByUserId: (...args: unknown[]) => mockNoteTypeFindByUserId(...args),
		findById: (...args: unknown[]) => mockNoteTypeFindById(...args),
	},
	localNoteFieldTypeRepository: {
		findByNoteTypeId: (...args: unknown[]) =>
			mockNoteFieldTypeFindByNoteTypeId(...args),
	},
	localNoteRepository: {
		createWithCards: (...args: unknown[]) => mockCreateWithCards(...args),
	},
}));

vi.mock("../atoms", () => ({
	syncActionAtom: atom(null, () => mockTriggerSync()),
	userAtom: atom({ id: "user-1", username: "alice" }),
}));

import { CreateNoteModal } from "./CreateNoteModal";

describe("CreateNoteModal", () => {
	const defaultProps = {
		isOpen: true,
		deckId: "deck-123",
		onClose: vi.fn(),
		onNoteCreated: vi.fn(),
	};

	const mockNoteTypes = [
		{
			id: "note-type-1",
			userId: "user-1",
			name: "Basic",
			frontTemplate: "{{Front}}",
			backTemplate: "{{Back}}",
			isReversible: false,
			createdAt: new Date("2026-01-01T00:00:00Z"),
			updatedAt: new Date("2026-01-01T00:00:00Z"),
			deletedAt: null,
			syncVersion: 0,
			_synced: true,
		},
		{
			id: "note-type-2",
			userId: "user-1",
			name: "Basic (reversed)",
			frontTemplate: "{{Front}}",
			backTemplate: "{{Back}}",
			isReversible: true,
			createdAt: new Date("2026-01-02T00:00:00Z"),
			updatedAt: new Date("2026-01-02T00:00:00Z"),
			deletedAt: null,
			syncVersion: 0,
			_synced: true,
		},
	];

	const mockFields = [
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
		mockNoteTypeFindByUserId.mockResolvedValue(mockNoteTypes);
		mockNoteTypeFindById.mockResolvedValue(mockNoteTypes[0]);
		mockNoteFieldTypeFindByNoteTypeId.mockResolvedValue(mockFields);
		mockCreateWithCards.mockResolvedValue({
			note: { id: "note-1" },
			fieldValues: [],
			cards: [{ id: "card-1", isReversed: false }],
		});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("does not render when closed", () => {
		render(<CreateNoteModal {...defaultProps} isOpen={false} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders modal when open", async () => {
		render(<CreateNoteModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(
			screen.getByRole("heading", { name: "Create New Note" }),
		).toBeDefined();

		await waitFor(() => {
			expect(screen.getByLabelText("Note Type")).toBeDefined();
		});
	});

	it("loads note types on open from local repository", async () => {
		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(mockNoteTypeFindByUserId).toHaveBeenCalledWith("user-1");
		});
	});

	it("auto-selects first note type and loads its fields", async () => {
		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
			expect(screen.getByLabelText("Back")).toBeDefined();
		});

		expect(mockNoteTypeFindById).toHaveBeenCalledWith("note-type-1");
		expect(mockNoteFieldTypeFindByNoteTypeId).toHaveBeenCalledWith(
			"note-type-1",
		);
	});

	it("displays note type options in select", async () => {
		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Note Type")).toBeDefined();
		});

		const options = screen.getAllByRole("option");
		expect(options).toHaveLength(2);
		expect(options[0]?.textContent).toBe("Basic");
		expect(options[1]?.textContent).toBe("Basic (reversed) (reversed)");
	});

	it("shows message when no note types available", async () => {
		mockNoteTypeFindByUserId.mockResolvedValueOnce([]);

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(
				screen.getByText(
					"No note types available. Please create a note type first.",
				),
			).toBeDefined();
		});
	});

	it("shows message when note type has no fields", async () => {
		mockNoteFieldTypeFindByNoteTypeId.mockResolvedValueOnce([]);

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(
				screen.getByText(
					"This note type has no fields. Please add fields to the note type first.",
				),
			).toBeDefined();
		});
	});

	it("disables create button when fields are empty", async () => {
		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		const createButton = screen.getByRole("button", { name: "Create Note" });
		expect(createButton).toHaveProperty("disabled", true);
	});

	it("enables create button when all fields have values", async () => {
		const user = userEvent.setup();
		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		await user.type(screen.getByLabelText("Front"), "Question");
		await user.type(screen.getByLabelText("Back"), "Answer");

		const createButton = screen.getByRole("button", { name: "Create Note" });
		expect(createButton).toHaveProperty("disabled", false);
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		render(<CreateNoteModal {...defaultProps} onClose={onClose} />);

		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("creates note via local repository with field values", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onNoteCreated = vi.fn();

		render(
			<CreateNoteModal
				isOpen={true}
				deckId="deck-123"
				onClose={onClose}
				onNoteCreated={onNoteCreated}
			/>,
		);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		await user.type(screen.getByLabelText("Front"), "What is 2+2?");
		await user.type(screen.getByLabelText("Back"), "4");
		await user.click(screen.getByRole("button", { name: "Create Note" }));

		await waitFor(() => {
			expect(mockCreateWithCards).toHaveBeenCalledWith({
				deckId: "deck-123",
				noteTypeId: "note-type-1",
				fields: {
					"field-1": "What is 2+2?",
					"field-2": "4",
				},
			});
		});

		expect(onNoteCreated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("trims whitespace from field values", async () => {
		const user = userEvent.setup();

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		await user.type(screen.getByLabelText("Front"), "  Question  ");
		await user.type(screen.getByLabelText("Back"), "  Answer  ");
		await user.click(screen.getByRole("button", { name: "Create Note" }));

		await waitFor(() => {
			expect(mockCreateWithCards).toHaveBeenCalledWith({
				deckId: "deck-123",
				noteTypeId: "note-type-1",
				fields: {
					"field-1": "Question",
					"field-2": "Answer",
				},
			});
		});
	});

	it("triggers a background sync after a successful create", async () => {
		const user = userEvent.setup();

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		await user.type(screen.getByLabelText("Front"), "Question");
		await user.type(screen.getByLabelText("Back"), "Answer");
		await user.click(screen.getByRole("button", { name: "Create Note" }));

		await waitFor(() => {
			expect(mockTriggerSync).toHaveBeenCalled();
		});
	});

	it("shows loading state during submission", async () => {
		const user = userEvent.setup();

		mockCreateWithCards.mockImplementationOnce(() => new Promise(() => {}));

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		await user.type(screen.getByLabelText("Front"), "Question");
		await user.type(screen.getByLabelText("Back"), "Answer");
		await user.click(screen.getByRole("button", { name: "Create Note" }));

		expect(screen.getByRole("button", { name: "Creating..." })).toBeDefined();
		expect(screen.getByRole("button", { name: "Creating..." })).toHaveProperty(
			"disabled",
			true,
		);
	});

	it("displays a generic error when the local write fails", async () => {
		const user = userEvent.setup();

		mockCreateWithCards.mockRejectedValueOnce(new Error("disk full"));

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		await user.type(screen.getByLabelText("Front"), "Question");
		await user.type(screen.getByLabelText("Back"), "Answer");
		await user.click(screen.getByRole("button", { name: "Create Note" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to create note. Please try again.",
			);
		});
	});

	it("switches note type and loads new fields", async () => {
		const user = userEvent.setup();

		const reversedFields = [
			{
				...mockFields[0],
				id: "field-3",
				noteTypeId: "note-type-2",
				name: "Question",
			},
			{
				...mockFields[1],
				id: "field-4",
				noteTypeId: "note-type-2",
				name: "Answer",
			},
		];

		mockNoteTypeFindById.mockImplementation(async (id: string) =>
			mockNoteTypes.find((nt) => nt.id === id),
		);
		mockNoteFieldTypeFindByNoteTypeId.mockImplementation(async (id: string) =>
			id === "note-type-2" ? reversedFields : mockFields,
		);

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		const select = screen.getByLabelText("Note Type");
		await user.selectOptions(select, "note-type-2");

		await waitFor(() => {
			expect(screen.getByLabelText("Question")).toBeDefined();
			expect(screen.getByLabelText("Answer")).toBeDefined();
		});

		expect(mockNoteTypeFindById).toHaveBeenCalledWith("note-type-2");
	});

	it("shows card count preview for reversible note type", async () => {
		mockNoteTypeFindById.mockResolvedValueOnce({
			...mockNoteTypes[0],
			isReversible: true,
		});

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("2 cards")).toBeDefined();
			expect(screen.getByText(/normal and reversed/)).toBeDefined();
		});
	});

	it("shows card count preview for non-reversible note type", async () => {
		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("1 card")).toBeDefined();
		});
	});

	it("displays error when note types fail to load", async () => {
		mockNoteTypeFindByUserId.mockRejectedValueOnce(new Error("disk error"));

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to load note types. Please try again.",
			);
		});
	});

	it("auto-selects defaultNoteTypeId when provided", async () => {
		render(
			<CreateNoteModal {...defaultProps} defaultNoteTypeId="note-type-2" />,
		);

		await waitFor(() => {
			expect(mockNoteTypeFindById).toHaveBeenCalledWith("note-type-2");
		});
	});
});
