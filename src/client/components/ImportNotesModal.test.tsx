/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockNoteTypesGet = vi.fn();
const mockNoteTypeGet = vi.fn();
const mockImportPost = vi.fn();
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
							import: {
								$post: (args: unknown) => mockImportPost(args),
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
import { ImportNotesModal } from "./ImportNotesModal";

describe("ImportNotesModal", () => {
	const defaultProps = {
		isOpen: true,
		deckId: "deck-123",
		onClose: vi.fn(),
		onImportComplete: vi.fn(),
	};

	const mockNoteTypes = [
		{ id: "note-type-1", name: "Basic" },
		{ id: "note-type-2", name: "Vocabulary" },
	];

	const mockBasicNoteType = {
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

	const mockVocabularyNoteType = {
		id: "note-type-2",
		name: "Vocabulary",
		frontTemplate: "{{Word or Phrase}}",
		backTemplate: "{{Meaning}}",
		isReversible: false,
		fields: [
			{ id: "field-3", name: "Word or Phrase", order: 0 },
			{ id: "field-4", name: "Example", order: 1 },
			{ id: "field-5", name: "Meaning", order: 2 },
		],
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockNoteTypesGet.mockResolvedValue({ ok: true });
		mockNoteTypeGet.mockResolvedValue({ ok: true });
		mockImportPost.mockResolvedValue({ ok: true });
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
		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockBasicNoteType })
			.mockResolvedValueOnce({ noteType: mockVocabularyNoteType });

		render(<ImportNotesModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(
			screen.getByRole("heading", { name: "Import Notes from CSV" }),
		).toBeDefined();
	});

	it("shows loading state while note types are being fetched", () => {
		mockNoteTypesGet.mockImplementation(() => new Promise(() => {})); // Never resolves

		render(<ImportNotesModal {...defaultProps} />);

		expect(screen.getByText("Loading note types...")).toBeDefined();
	});

	it("displays expected format for each note type", async () => {
		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockBasicNoteType })
			.mockResolvedValueOnce({ noteType: mockVocabularyNoteType });

		render(<ImportNotesModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText(/note_type,Front,Back/)).toBeDefined();
			expect(screen.getByText(/Basic,\.\.\.,\.\.\./)).toBeDefined();
		});

		await waitFor(() => {
			expect(
				screen.getByText(/note_type,Word or Phrase,Example,Meaning/),
			).toBeDefined();
			expect(screen.getByText(/Vocabulary,\.\.\.,\.\.\.,\.\.\./)).toBeDefined();
		});
	});

	it("sorts fields by order when displaying expected format", async () => {
		const noteTypeWithUnorderedFields = {
			id: "note-type-3",
			name: "Test",
			frontTemplate: "{{A}}",
			backTemplate: "{{B}}",
			isReversible: false,
			fields: [
				{ id: "field-c", name: "C", order: 2 },
				{ id: "field-a", name: "A", order: 0 },
				{ id: "field-b", name: "B", order: 1 },
			],
		};

		mockHandleResponse
			.mockResolvedValueOnce({
				noteTypes: [{ id: "note-type-3", name: "Test" }],
			})
			.mockResolvedValueOnce({ noteType: noteTypeWithUnorderedFields });

		render(<ImportNotesModal {...defaultProps} />);

		await waitFor(() => {
			// Should be A,B,C (sorted by order), not C,A,B
			expect(screen.getByText(/note_type,A,B,C/)).toBeDefined();
		});
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockBasicNoteType })
			.mockResolvedValueOnce({ noteType: mockVocabularyNoteType });

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

		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockBasicNoteType })
			.mockResolvedValueOnce({ noteType: mockVocabularyNoteType });

		render(<ImportNotesModal {...defaultProps} onClose={onClose} />);

		await waitFor(() => {
			expect(screen.getByRole("dialog")).toBeDefined();
		});

		const dialog = screen.getByRole("dialog");
		await user.click(dialog);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("displays error when note types fail to load", async () => {
		mockHandleResponse.mockRejectedValueOnce(
			new ApiClientError("Server error", 500),
		);

		render(<ImportNotesModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain("Server error");
		});
	});

	it("shows file input in upload phase", async () => {
		mockHandleResponse
			.mockResolvedValueOnce({ noteTypes: mockNoteTypes })
			.mockResolvedValueOnce({ noteType: mockBasicNoteType })
			.mockResolvedValueOnce({ noteType: mockVocabularyNoteType });

		render(<ImportNotesModal {...defaultProps} />);

		await waitFor(() => {
			expect(screen.getByText("Choose File")).toBeDefined();
			expect(screen.getByText("Select a CSV file to import")).toBeDefined();
		});
	});
});
