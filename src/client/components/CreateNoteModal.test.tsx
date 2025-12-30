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
import { CreateNoteModal } from "./CreateNoteModal";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

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
		vi.mocked(apiClient.getAuthHeader).mockReturnValue({
			Authorization: "Bearer access-token",
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
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

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
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith("/api/note-types", {
				headers: { Authorization: "Bearer access-token" },
			});
		});
	});

	it("auto-selects first note type and loads its fields", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

		render(<CreateNoteModal {...defaultProps} />);

		// Wait for fields to be loaded
		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
			expect(screen.getByLabelText("Back")).toBeDefined();
		});

		// Verify the note type details were fetched
		expect(mockFetch).toHaveBeenCalledWith("/api/note-types/note-type-1", {
			headers: { Authorization: "Bearer access-token" },
		});
	});

	it("displays note type options in select", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

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
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ noteTypes: [] }),
		});

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

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: noteTypeWithNoFields }),
			});

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
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		const createButton = screen.getByRole("button", { name: "Create Note" });
		expect(createButton).toHaveProperty("disabled", true);
	});

	it("enables create button when all fields have values", async () => {
		const user = userEvent.setup();

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

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

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

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

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

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

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					note: { id: "note-1" },
					fieldValues: [],
					cards: [{ id: "card-1", isReversed: false }],
				}),
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
			expect(mockFetch).toHaveBeenCalledWith("/api/decks/deck-123/notes", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer access-token",
				},
				body: JSON.stringify({
					noteTypeId: "note-type-1",
					fields: {
						"field-1": "What is 2+2?",
						"field-2": "4",
					},
				}),
			});
		});

		expect(onNoteCreated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("trims whitespace from field values", async () => {
		const user = userEvent.setup();

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					note: { id: "note-1" },
					fieldValues: [],
					cards: [],
				}),
			});

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		await user.type(screen.getByLabelText("Front"), "  Question  ");
		await user.type(screen.getByLabelText("Back"), "  Answer  ");
		await user.click(screen.getByRole("button", { name: "Create Note" }));

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith("/api/decks/deck-123/notes", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer access-token",
				},
				body: JSON.stringify({
					noteTypeId: "note-type-1",
					fields: {
						"field-1": "Question",
						"field-2": "Answer",
					},
				}),
			});
		});
	});

	it("shows loading state during submission", async () => {
		const user = userEvent.setup();

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			})
			.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

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

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({ error: "Note type not found" }),
			});

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

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			})
			.mockRejectedValueOnce(new Error("Network error"));

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

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: reversedNoteType }),
			});

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
		expect(mockFetch).toHaveBeenCalledWith("/api/note-types/note-type-2", {
			headers: { Authorization: "Bearer access-token" },
		});
	});

	it("shows card count preview for reversible note type", async () => {
		const reversedNoteType = {
			...mockNoteTypeWithFields,
			isReversible: true,
		};

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: reversedNoteType }),
			});

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("2 cards")).toBeDefined();
			expect(screen.getByText(/normal and reversed/)).toBeDefined();
		});
	});

	it("shows card count preview for non-reversible note type", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("1 card")).toBeDefined();
		});
	});

	it("displays error when note types fail to load", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: async () => ({ error: "Server error" }),
		});

		render(<CreateNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain("Server error");
		});
	});

	it("resets form when closed and reopened", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

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

		// Setup mocks for reopening
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

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
