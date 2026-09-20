/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { atom } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNoteTypeFindByUserId = vi.fn();
const mockNoteFieldTypeFindByNoteTypeId = vi.fn();
const mockBulkCreateWithCards = vi.fn();
const mockTriggerSync = vi.fn(() => Promise.resolve(null));

vi.mock("../db/repositories", () => ({
	localNoteTypeRepository: {
		findByUserId: (...args: unknown[]) => mockNoteTypeFindByUserId(...args),
	},
	localNoteFieldTypeRepository: {
		findByNoteTypeId: (...args: unknown[]) =>
			mockNoteFieldTypeFindByNoteTypeId(...args),
	},
	localNoteRepository: {
		bulkCreateWithCards: (...args: unknown[]) =>
			mockBulkCreateWithCards(...args),
	},
}));

vi.mock("../atoms", () => ({
	syncActionAtom: atom(null, () => mockTriggerSync()),
	userAtom: atom({ id: "user-1", username: "alice" }),
}));

import { ImportNotesModal } from "./ImportNotesModal";

describe("ImportNotesModal", () => {
	const defaultProps = {
		isOpen: true,
		deckId: "deck-123",
		onClose: vi.fn(),
		onImportComplete: vi.fn(),
	};

	const basicNoteType = {
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
	};

	const vocabularyNoteType = {
		...basicNoteType,
		id: "note-type-2",
		name: "Vocabulary",
		createdAt: new Date("2026-01-02T00:00:00Z"),
		updatedAt: new Date("2026-01-02T00:00:00Z"),
	};

	const basicFields = [
		{ id: "field-1", noteTypeId: "note-type-1", name: "Front", order: 0 },
		{ id: "field-2", noteTypeId: "note-type-1", name: "Back", order: 1 },
	];

	const vocabularyFields = [
		{
			id: "field-3",
			noteTypeId: "note-type-2",
			name: "Word or Phrase",
			order: 0,
		},
		{ id: "field-4", noteTypeId: "note-type-2", name: "Example", order: 1 },
		{ id: "field-5", noteTypeId: "note-type-2", name: "Meaning", order: 2 },
	];

	/**
	 * Upload a CSV file through the modal's file input
	 */
	async function uploadCsv(
		user: ReturnType<typeof userEvent.setup>,
		csv: string,
	) {
		const file = new File([csv], "notes.csv", { type: "text/csv" });
		// jsdom's File does not implement Blob.text()
		Object.defineProperty(file, "text", {
			value: () => Promise.resolve(csv),
		});
		await user.upload(screen.getByLabelText("Choose File"), file);
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockNoteTypeFindByUserId.mockResolvedValue([
			basicNoteType,
			vocabularyNoteType,
		]);
		mockNoteFieldTypeFindByNoteTypeId.mockImplementation(
			async (noteTypeId: string) =>
				noteTypeId === "note-type-1" ? basicFields : vocabularyFields,
		);
		mockBulkCreateWithCards.mockResolvedValue({ created: 0, failed: [] });
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("does not render when closed", () => {
		render(<ImportNotesModal {...defaultProps} isOpen={false} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders modal when open", async () => {
		render(<ImportNotesModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(
			screen.getByRole("heading", { name: "Import Notes from CSV" }),
		).toBeDefined();
	});

	it("shows loading state while note types are being fetched", () => {
		mockNoteTypeFindByUserId.mockImplementation(() => new Promise(() => {}));

		render(<ImportNotesModal {...defaultProps} />);

		expect(screen.getByText("Loading note types...")).toBeDefined();
	});

	it("displays expected format for each note type", async () => {
		render(<ImportNotesModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText(/note_type,Front,Back/)).toBeDefined();
			expect(screen.getByText(/Basic,\.\.\.,\.\.\./)).toBeDefined();
		});

		expect(
			screen.getByText(/note_type,Word or Phrase,Example,Meaning/),
		).toBeDefined();
		expect(screen.getByText(/Vocabulary,\.\.\.,\.\.\.,\.\.\./)).toBeDefined();
	});

	it("sorts fields by order when displaying expected format", async () => {
		mockNoteTypeFindByUserId.mockResolvedValue([basicNoteType]);
		mockNoteFieldTypeFindByNoteTypeId.mockResolvedValue([
			{ id: "field-c", noteTypeId: "note-type-1", name: "C", order: 2 },
			{ id: "field-a", noteTypeId: "note-type-1", name: "A", order: 0 },
			{ id: "field-b", noteTypeId: "note-type-1", name: "B", order: 1 },
		]);

		render(<ImportNotesModal {...defaultProps} />);

		await waitFor(() => {
			// Should be A,B,C (sorted by order), not C,A,B
			expect(screen.getByText(/note_type,A,B,C/)).toBeDefined();
		});
	});

	it("tells the user when there is no note type to import into", async () => {
		mockNoteTypeFindByUserId.mockResolvedValue([]);

		render(<ImportNotesModal {...defaultProps} />);

		await waitFor(() => {
			expect(
				screen.getByText(
					"No note types available. Please create a note type first.",
				),
			).toBeDefined();
		});
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		render(<ImportNotesModal {...defaultProps} onClose={onClose} />);

		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("calls onClose when clicking outside the modal", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		render(<ImportNotesModal {...defaultProps} onClose={onClose} />);

		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeDefined();
		});

		await user.click(screen.getByRole("dialog"));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("displays error when note types fail to load", async () => {
		mockNoteTypeFindByUserId.mockRejectedValue(new Error("db closed"));

		render(<ImportNotesModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to load note types",
			);
		});
	});

	it("shows file input in upload phase", async () => {
		render(<ImportNotesModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Choose File")).toBeDefined();
			expect(screen.getByText("Select a CSV file to import")).toBeDefined();
		});
	});

	it("previews the parsed rows and reports invalid ones", async () => {
		const user = userEvent.setup();
		render(<ImportNotesModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Choose File")).toBeDefined();
		});

		await uploadCsv(
			user,
			"note_type,Front,Back\nBasic,Q1,A1\nUnknown,Q2,A2\nBasic,Q3,A3\n",
		);

		await waitFor(() => {
			expect(
				screen.getByText(/note\(s\) ready to import/).textContent,
			).toContain("2 note(s) ready to import");
		});
		expect(screen.getByText("1 error(s) found")).toBeDefined();
		expect(
			screen.getByText('Row 3: Note type "Unknown" not found'),
		).toBeDefined();
	});

	it("imports the validated rows into IndexedDB and triggers a sync", async () => {
		const user = userEvent.setup();
		mockBulkCreateWithCards.mockResolvedValue({ created: 2, failed: [] });
		const onImportComplete = vi.fn();

		render(
			<ImportNotesModal
				{...defaultProps}
				onImportComplete={onImportComplete}
			/>,
		);

		await waitFor(() => {
			expect(screen.getByText("Choose File")).toBeDefined();
		});

		await uploadCsv(user, "note_type,Front,Back\nBasic,Q1,A1\nBasic,Q2,A2\n");

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Import 2 Note(s)" }),
			).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Import 2 Note(s)" }));

		await waitFor(() => {
			expect(screen.getByText("Import complete!")).toBeDefined();
		});

		expect(mockBulkCreateWithCards).toHaveBeenCalledTimes(1);
		expect(mockBulkCreateWithCards.mock.calls[0]?.[0]).toEqual({
			deckId: "deck-123",
			notes: [
				{
					noteTypeId: "note-type-1",
					fields: { "field-1": "Q1", "field-2": "A1" },
				},
				{
					noteTypeId: "note-type-1",
					fields: { "field-1": "Q2", "field-2": "A2" },
				},
			],
		});
		expect(screen.getByText("2 note(s) imported successfully")).toBeDefined();
		expect(onImportComplete).toHaveBeenCalledTimes(1);
		expect(mockTriggerSync).toHaveBeenCalledTimes(1);
	});

	it("imports 1000 rows and shows progress while doing so", async () => {
		const user = userEvent.setup();
		let reportProgress: ((done: number, total: number) => void) | undefined;
		let finishImport: (() => void) | undefined;
		mockBulkCreateWithCards.mockImplementation(
			(
				_input: unknown,
				options: { onProgress?: (done: number, total: number) => void },
			) => {
				reportProgress = options.onProgress;
				return new Promise((resolve) => {
					finishImport = () => resolve({ created: 1000, failed: [] });
				});
			},
		);

		render(<ImportNotesModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Choose File")).toBeDefined();
		});

		const rows = Array.from(
			{ length: 1000 },
			(_, i) => `Basic,Q${i},A${i}`,
		).join("\n");
		await uploadCsv(user, `note_type,Front,Back\n${rows}\n`);

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Import 1000 Note(s)" }),
			).toBeDefined();
		});

		await user.click(
			screen.getByRole("button", { name: "Import 1000 Note(s)" }),
		);

		await waitFor(() => {
			expect(screen.getByRole("progressbar")).toBeDefined();
		});

		const notes = mockBulkCreateWithCards.mock.calls[0]?.[0] as {
			notes: unknown[];
		};
		expect(notes.notes).toHaveLength(1000);

		reportProgress?.(400, 1000);
		await waitFor(() => {
			expect(
				screen.getByRole("progressbar").getAttribute("aria-valuenow"),
			).toBe("400");
		});
		expect(screen.getByText(/Importing notes\.\.\. 400 \/ 1000/)).toBeDefined();

		finishImport?.();
		await waitFor(() => {
			expect(
				screen.getByText("1000 note(s) imported successfully"),
			).toBeDefined();
		});
	});

	it("lists the rows that could not be imported", async () => {
		const user = userEvent.setup();
		mockBulkCreateWithCards.mockResolvedValue({
			created: 1,
			failed: [{ index: 1, error: "Note type not found" }],
		});

		render(<ImportNotesModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Choose File")).toBeDefined();
		});

		await uploadCsv(user, "note_type,Front,Back\nBasic,Q1,A1\nBasic,Q2,A2\n");

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Import 2 Note(s)" }),
			).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Import 2 Note(s)" }));

		await waitFor(() => {
			expect(screen.getByText("1 failed:")).toBeDefined();
		});
		expect(screen.getByText("Row 3: Note type not found")).toBeDefined();
	});

	it("shows an error and returns to the preview when the import fails", async () => {
		const user = userEvent.setup();
		mockBulkCreateWithCards.mockRejectedValue(new Error("QuotaExceeded"));

		render(<ImportNotesModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Choose File")).toBeDefined();
		});

		await uploadCsv(user, "note_type,Front,Back\nBasic,Q1,A1\n");

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Import 1 Note(s)" }),
			).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Import 1 Note(s)" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to import notes",
			);
		});
		expect(
			screen.getByRole("button", { name: "Import 1 Note(s)" }),
		).toBeDefined();
	});
});
