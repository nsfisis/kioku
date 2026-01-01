/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNoteGet = vi.fn();
const mockNotePut = vi.fn();
const mockNoteTypeGet = vi.fn();
const mockHandleResponse = vi.fn();

vi.mock("../api/client", () => ({
	apiClient: {
		rpc: {
			api: {
				decks: {
					":deckId": {
						notes: {
							":noteId": {
								$get: (args: unknown) => mockNoteGet(args),
								$put: (args: unknown) => mockNotePut(args),
							},
						},
					},
				},
				"note-types": {
					":id": {
						$get: (args: unknown) => mockNoteTypeGet(args),
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
import { EditNoteModal } from "./EditNoteModal";

describe("EditNoteModal", () => {
	const defaultProps = {
		isOpen: true,
		deckId: "deck-123",
		noteId: "note-456",
		onClose: vi.fn(),
		onNoteUpdated: vi.fn(),
	};

	const mockNoteWithFieldValues = {
		id: "note-456",
		deckId: "deck-123",
		noteTypeId: "note-type-1",
		fieldValues: [
			{
				id: "fv-1",
				noteId: "note-456",
				noteFieldTypeId: "field-1",
				value: "Existing front",
			},
			{
				id: "fv-2",
				noteId: "note-456",
				noteFieldTypeId: "field-2",
				value: "Existing back",
			},
		],
	};

	const mockNoteTypeWithFields = {
		id: "note-type-1",
		name: "Basic",
		frontTemplate: "{{Front}}",
		backTemplate: "{{Back}}",
		isReversible: false,
		fields: [
			{ id: "field-1", name: "Front", order: 0 },
			{ id: "field-2", name: "Back", order: 1 },
		],
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockNoteGet.mockResolvedValue({ ok: true });
		mockNotePut.mockResolvedValue({ ok: true });
		mockNoteTypeGet.mockResolvedValue({ ok: true });
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
		mockHandleResponse
			.mockResolvedValueOnce({ note: mockNoteWithFieldValues })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		render(<EditNoteModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(screen.getByRole("heading", { name: "Edit Note" })).toBeDefined();

		// Wait for fields to load
		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});
	});

	it("fetches note and note type on open", async () => {
		mockHandleResponse
			.mockResolvedValueOnce({ note: mockNoteWithFieldValues })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(mockNoteGet).toHaveBeenCalledWith({
				param: { deckId: "deck-123", noteId: "note-456" },
			});
		});

		await waitFor(() => {
			expect(mockNoteTypeGet).toHaveBeenCalledWith({
				param: { id: "note-type-1" },
			});
		});
	});

	it("populates form with note field values", async () => {
		mockHandleResponse
			.mockResolvedValueOnce({ note: mockNoteWithFieldValues })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

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
		mockHandleResponse
			.mockResolvedValueOnce({ note: mockNoteWithFieldValues })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Basic")).toBeDefined();
		});
	});

	it("disables save button when fields are empty", async () => {
		const user = userEvent.setup();

		mockHandleResponse
			.mockResolvedValueOnce({ note: mockNoteWithFieldValues })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		// Clear front field
		const frontInput = screen.getByLabelText("Front");
		await user.clear(frontInput);

		const saveButton = screen.getByRole("button", { name: "Save Changes" });
		expect(saveButton).toHaveProperty("disabled", true);
	});

	it("enables save button when all fields have values", async () => {
		mockHandleResponse
			.mockResolvedValueOnce({ note: mockNoteWithFieldValues })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

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

		mockHandleResponse
			.mockResolvedValueOnce({ note: mockNoteWithFieldValues })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		render(<EditNoteModal {...defaultProps} onClose={onClose} />);

		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("calls onClose when clicking outside the modal", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		mockHandleResponse
			.mockResolvedValueOnce({ note: mockNoteWithFieldValues })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		render(<EditNoteModal {...defaultProps} onClose={onClose} />);

		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeDefined();
		});

		// Click on the backdrop (the dialog element itself)
		const dialog = screen.getByRole("dialog");
		await user.click(dialog);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("updates note with new field values", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onNoteUpdated = vi.fn();

		mockHandleResponse
			.mockResolvedValueOnce({ note: mockNoteWithFieldValues })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields })
			.mockResolvedValueOnce({ note: mockNoteWithFieldValues });

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
			expect(mockNotePut).toHaveBeenCalledWith({
				param: { deckId: "deck-123", noteId: "note-456" },
				json: {
					fields: {
						"field-1": "Updated front",
						"field-2": "Existing back",
					},
				},
			});
		});

		expect(onNoteUpdated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("trims whitespace from field values", async () => {
		const user = userEvent.setup();

		const noteWithWhitespace = {
			...mockNoteWithFieldValues,
			fieldValues: [
				{
					id: "fv-1",
					noteId: "note-456",
					noteFieldTypeId: "field-1",
					value: "  Trimmed  ",
				},
				{
					id: "fv-2",
					noteId: "note-456",
					noteFieldTypeId: "field-2",
					value: "  Value  ",
				},
			],
		};

		mockHandleResponse
			.mockResolvedValueOnce({ note: noteWithWhitespace })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields })
			.mockResolvedValueOnce({ note: noteWithWhitespace });

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(mockNotePut).toHaveBeenCalledWith({
				param: { deckId: "deck-123", noteId: "note-456" },
				json: {
					fields: {
						"field-1": "Trimmed",
						"field-2": "Value",
					},
				},
			});
		});
	});

	it("shows loading state during fetch", async () => {
		mockNoteGet.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

		render(<EditNoteModal {...defaultProps} />);

		expect(screen.getByText("Loading note...")).toBeDefined();
	});

	it("shows loading state during submission", async () => {
		const user = userEvent.setup();

		mockHandleResponse
			.mockResolvedValueOnce({ note: mockNoteWithFieldValues })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		mockNotePut.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

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

	it("displays API error message when note fetch fails", async () => {
		mockHandleResponse.mockRejectedValueOnce(
			new ApiClientError("Note not found", 404),
		);

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain("Note not found");
		});
	});

	it("displays API error message when note type fetch fails", async () => {
		mockHandleResponse
			.mockResolvedValueOnce({ note: mockNoteWithFieldValues })
			.mockRejectedValueOnce(new ApiClientError("Note type not found", 404));

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Note type not found",
			);
		});
	});

	it("displays API error message when update fails", async () => {
		const user = userEvent.setup();

		mockHandleResponse
			.mockResolvedValueOnce({ note: mockNoteWithFieldValues })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields })
			.mockRejectedValueOnce(new ApiClientError("Failed to update note", 400));

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to update note",
			);
		});
	});

	it("displays generic error on unexpected failure", async () => {
		mockNoteGet.mockRejectedValueOnce(new Error("Network error"));

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to load note. Please try again.",
			);
		});
	});

	it("resets form when modal is closed and reopened with different noteId", async () => {
		const onClose = vi.fn();

		mockHandleResponse
			.mockResolvedValueOnce({ note: mockNoteWithFieldValues })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		const { rerender } = render(
			<EditNoteModal
				isOpen={true}
				deckId="deck-123"
				noteId="note-456"
				onClose={onClose}
				onNoteUpdated={vi.fn()}
			/>,
		);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toHaveProperty(
				"value",
				"Existing front",
			);
		});

		// Close modal
		rerender(
			<EditNoteModal
				isOpen={false}
				deckId="deck-123"
				noteId={null}
				onClose={onClose}
				onNoteUpdated={vi.fn()}
			/>,
		);

		// Setup new note data
		const newNoteWithFieldValues = {
			id: "note-789",
			deckId: "deck-123",
			noteTypeId: "note-type-1",
			fieldValues: [
				{
					id: "fv-3",
					noteId: "note-789",
					noteFieldTypeId: "field-1",
					value: "New front",
				},
				{
					id: "fv-4",
					noteId: "note-789",
					noteFieldTypeId: "field-2",
					value: "New back",
				},
			],
		};

		mockHandleResponse
			.mockResolvedValueOnce({ note: newNoteWithFieldValues })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		// Reopen with different noteId
		rerender(
			<EditNoteModal
				isOpen={true}
				deckId="deck-123"
				noteId="note-789"
				onClose={onClose}
				onNoteUpdated={vi.fn()}
			/>,
		);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toHaveProperty(
				"value",
				"New front",
			);
			expect(screen.getByLabelText("Back")).toHaveProperty("value", "New back");
		});
	});

	it("shows reversed indicator for reversible note type", async () => {
		const reversibleNoteType = {
			...mockNoteTypeWithFields,
			isReversible: true,
		};

		mockHandleResponse
			.mockResolvedValueOnce({ note: mockNoteWithFieldValues })
			.mockResolvedValueOnce({ noteType: reversibleNoteType });

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Basic (reversed)")).toBeDefined();
		});
	});
});
