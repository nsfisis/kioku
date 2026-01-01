/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNoteTypesGet = vi.fn();
const mockNoteTypeGet = vi.fn();
const mockNotesPost = vi.fn();
const mockHandleResponse = vi.fn();

vi.mock("../api/client", () => ({
	apiClient: {
		rpc: {
			api: {
				"note-types": {
					$get: () => mockNoteTypesGet(),
					":id": {
						$get: (args: unknown) => mockNoteTypeGet(args),
					},
				},
				decks: {
					":deckId": {
						notes: {
							$post: (args: unknown) => mockNotesPost(args),
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
import { CreateNoteModal } from "./CreateNoteModal";

describe("CreateNoteModal", () => {
	const defaultProps = {
		isOpen: true,
		deckId: "deck-123",
		onClose: vi.fn(),
		onNoteCreated: vi.fn(),
	};

	const mockNoteTypes = [
		{ id: "note-type-1", name: "Basic", isReversible: false },
		{ id: "note-type-2", name: "Basic (reversed)", isReversible: true },
	];

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
		mockNoteTypesGet.mockResolvedValue({ ok: true });
		mockNoteTypeGet.mockResolvedValue({ ok: true });
		mockNotesPost.mockResolvedValue({ ok: true });
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
		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		render(<CreateNoteModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(
			screen.getByRole("heading", { name: "Create New Note" }),
		).toBeDefined();

		// Wait for note types to load
		await waitFor(() => {
			expect(screen.getByLabelText("Note Type")).toBeDefined();
		});
	});

	it("loads note types on open", async () => {
		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(mockNoteTypesGet).toHaveBeenCalled();
		});
	});

	it("auto-selects first note type and loads its fields", async () => {
		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		render(<CreateNoteModal {...defaultProps} />);

		// Wait for fields to be loaded
		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
			expect(screen.getByLabelText("Back")).toBeDefined();
		});

		// Verify the note type details were fetched
		expect(mockNoteTypeGet).toHaveBeenCalledWith({
			param: { id: "note-type-1" },
		});
	});

	it("displays note type options in select", async () => {
		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			const select = screen.getByLabelText("Note Type");
			expect(select).toBeDefined();
		});

		const options = screen.getAllByRole("option");
		expect(options).toHaveLength(2);
		expect(options[0]?.textContent).toBe("Basic");
		expect(options[1]?.textContent).toBe("Basic (reversed) (reversed)");
	});

	it("shows message when no note types available", async () => {
		mockHandleResponse.mockResolvedValueOnce({ noteTypes: [] });

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
		const noteTypeWithNoFields = {
			...mockNoteTypeWithFields,
			fields: [],
		};

		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: noteTypeWithNoFields });

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
		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		const createButton = screen.getByRole("button", { name: "Create Note" });
		expect(createButton).toHaveProperty("disabled", true);
	});

	it("enables create button when all fields have values", async () => {
		const user = userEvent.setup();

		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

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

		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		render(<CreateNoteModal {...defaultProps} onClose={onClose} />);

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
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		render(<CreateNoteModal {...defaultProps} onClose={onClose} />);

		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeDefined();
		});

		// Click on the backdrop (the dialog element itself)
		const dialog = screen.getByRole("dialog");
		await user.click(dialog);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("creates note with field values", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onNoteCreated = vi.fn();

		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields })
			.mockResolvedValueOnce({
				note: { id: "note-1" },
				fieldValues: [],
				cards: [{ id: "card-1", isReversed: false }],
			});

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
			expect(mockNotesPost).toHaveBeenCalledWith({
				param: { deckId: "deck-123" },
				json: {
					noteTypeId: "note-type-1",
					fields: {
						"field-1": "What is 2+2?",
						"field-2": "4",
					},
				},
			});
		});

		expect(onNoteCreated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("trims whitespace from field values", async () => {
		const user = userEvent.setup();

		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields })
			.mockResolvedValueOnce({
				note: { id: "note-1" },
				fieldValues: [],
				cards: [],
			});

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		await user.type(screen.getByLabelText("Front"), "  Question  ");
		await user.type(screen.getByLabelText("Back"), "  Answer  ");
		await user.click(screen.getByRole("button", { name: "Create Note" }));

		await waitFor(() => {
			expect(mockNotesPost).toHaveBeenCalledWith({
				param: { deckId: "deck-123" },
				json: {
					noteTypeId: "note-type-1",
					fields: {
						"field-1": "Question",
						"field-2": "Answer",
					},
				},
			});
		});
	});

	it("shows loading state during submission", async () => {
		const user = userEvent.setup();

		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		mockNotesPost.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

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

	it("displays API error message", async () => {
		const user = userEvent.setup();

		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields })
			.mockRejectedValueOnce(new ApiClientError("Note type not found", 400));

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		await user.type(screen.getByLabelText("Front"), "Question");
		await user.type(screen.getByLabelText("Back"), "Answer");
		await user.click(screen.getByRole("button", { name: "Create Note" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Note type not found",
			);
		});
	});

	it("displays generic error on unexpected failure", async () => {
		const user = userEvent.setup();

		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		mockNotesPost.mockRejectedValueOnce(new Error("Network error"));

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

		const reversedNoteType = {
			id: "note-type-2",
			name: "Basic (reversed)",
			frontTemplate: "{{Front}}",
			backTemplate: "{{Back}}",
			isReversible: true,
			fields: [
				{ id: "field-3", name: "Question", order: 0 },
				{ id: "field-4", name: "Answer", order: 1 },
			],
		};

		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields })
			.mockResolvedValueOnce({ noteType: reversedNoteType });

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		// Change note type
		const select = screen.getByLabelText("Note Type");
		await user.selectOptions(select, "note-type-2");

		// Wait for new fields to load
		await waitFor(() => {
			expect(screen.getByLabelText("Question")).toBeDefined();
			expect(screen.getByLabelText("Answer")).toBeDefined();
		});

		// Verify the note type details were fetched for the new type
		expect(mockNoteTypeGet).toHaveBeenCalledWith({
			param: { id: "note-type-2" },
		});
	});

	it("shows card count preview for reversible note type", async () => {
		const reversedNoteType = {
			...mockNoteTypeWithFields,
			isReversible: true,
		};

		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: reversedNoteType });

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("2 cards")).toBeDefined();
			expect(screen.getByText(/normal and reversed/)).toBeDefined();
		});
	});

	it("shows card count preview for non-reversible note type", async () => {
		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("1 card")).toBeDefined();
		});
	});

	it("displays error when note types fail to load", async () => {
		mockHandleResponse.mockRejectedValueOnce(
			new ApiClientError("Server error", 500),
		);

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain("Server error");
		});
	});

	it("resets form when closed and reopened", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockNoteTypeWithFields });

		const { rerender } = render(
			<CreateNoteModal
				isOpen={true}
				deckId="deck-123"
				onClose={onClose}
				onNoteCreated={vi.fn()}
			/>,
		);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		// Type something in the form
		await user.type(screen.getByLabelText("Front"), "Question");
		await user.type(screen.getByLabelText("Back"), "Answer");

		// Click cancel to close
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		// Note: The component already has note types loaded (hasLoadedNoteTypes = true)
		// so it won't fetch again

		// Reopen the modal
		rerender(
			<CreateNoteModal
				isOpen={true}
				deckId="deck-123"
				onClose={onClose}
				onNoteCreated={vi.fn()}
			/>,
		);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		// Form should be reset
		expect(screen.getByLabelText("Front")).toHaveProperty("value", "");
		expect(screen.getByLabelText("Back")).toHaveProperty("value", "");
	});
});
