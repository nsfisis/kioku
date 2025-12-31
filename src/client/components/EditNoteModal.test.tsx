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
import { EditNoteModal } from "./EditNoteModal";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

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
		vi.mocked(apiClient.getAuthHeader).mockReturnValue({
			Authorization: "Bearer access-token",
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
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: mockNoteWithFieldValues }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

		render(<EditNoteModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(screen.getByRole("heading", { name: "Edit Note" })).toBeDefined();

		// Wait for fields to load
		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});
	});

	it("fetches note and note type on open", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: mockNoteWithFieldValues }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith(
				"/api/decks/deck-123/notes/note-456",
				{
					headers: { Authorization: "Bearer access-token" },
				},
			);
		});

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith("/api/note-types/note-type-1", {
				headers: { Authorization: "Bearer access-token" },
			});
		});
	});

	it("populates form with note field values", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: mockNoteWithFieldValues }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

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
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: mockNoteWithFieldValues }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Basic")).toBeDefined();
		});
	});

	it("disables save button when fields are empty", async () => {
		const user = userEvent.setup();

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: mockNoteWithFieldValues }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

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
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: mockNoteWithFieldValues }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

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

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: mockNoteWithFieldValues }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

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

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: mockNoteWithFieldValues }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

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

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: mockNoteWithFieldValues }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: mockNoteWithFieldValues }),
			});

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
			expect(mockFetch).toHaveBeenCalledWith(
				"/api/decks/deck-123/notes/note-456",
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Bearer access-token",
					},
					body: JSON.stringify({
						fields: {
							"field-1": "Updated front",
							"field-2": "Existing back",
						},
					}),
				},
			);
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

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: noteWithWhitespace }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: noteWithWhitespace }),
			});

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByLabelText("Front")).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Save Changes" }));

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith(
				"/api/decks/deck-123/notes/note-456",
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: "Bearer access-token",
					},
					body: JSON.stringify({
						fields: {
							"field-1": "Trimmed",
							"field-2": "Value",
						},
					}),
				},
			);
		});
	});

	it("shows loading state during fetch", async () => {
		mockFetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

		render(<EditNoteModal {...defaultProps} />);

		expect(screen.getByText("Loading note...")).toBeDefined();
	});

	it("shows loading state during submission", async () => {
		const user = userEvent.setup();

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: mockNoteWithFieldValues }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			})
			.mockImplementationOnce(() => new Promise(() => {})); // Never resolves

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
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 404,
			json: async () => ({ error: "Note not found" }),
		});

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain("Note not found");
		});
	});

	it("displays API error message when note type fetch fails", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: mockNoteWithFieldValues }),
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: async () => ({ error: "Note type not found" }),
			});

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Note type not found",
			);
		});
	});

	it("displays API error message when update fails", async () => {
		const user = userEvent.setup();

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: mockNoteWithFieldValues }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 400,
				json: async () => ({ error: "Failed to update note" }),
			});

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
		mockFetch.mockRejectedValueOnce(new Error("Network error"));

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to load note. Please try again.",
			);
		});
	});

	it("displays error when not authenticated", async () => {
		vi.mocked(apiClient.getAuthHeader).mockReturnValue(undefined);

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Not authenticated",
			);
		});
	});

	it("resets form when modal is closed and reopened with different noteId", async () => {
		const onClose = vi.fn();

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: mockNoteWithFieldValues }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

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

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: newNoteWithFieldValues }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: mockNoteTypeWithFields }),
			});

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

		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ note: mockNoteWithFieldValues }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteType: reversibleNoteType }),
			});

		render(<EditNoteModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Basic (reversed)")).toBeDefined();
		});
	});
});
