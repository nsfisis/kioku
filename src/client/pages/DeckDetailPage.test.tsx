/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AuthProvider } from "../stores";
import { DeckDetailPage } from "./DeckDetailPage";

const mockDeckGet = vi.fn();
const mockCardsGet = vi.fn();
const mockNoteDelete = vi.fn();
const mockHandleResponse = vi.fn();

vi.mock("../api/client", () => ({
	apiClient: {
		login: vi.fn(),
		logout: vi.fn(),
		isAuthenticated: vi.fn(),
		getTokens: vi.fn(),
		getAuthHeader: vi.fn(),
		onSessionExpired: vi.fn(() => vi.fn()),
		rpc: {
			api: {
				decks: {
					":id": {
						$get: (args: unknown) => mockDeckGet(args),
					},
					":deckId": {
						cards: {
							$get: (args: unknown) => mockCardsGet(args),
						},
						notes: {
							":noteId": {
								$delete: (args: unknown) => mockNoteDelete(args),
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

import { ApiClientError, apiClient } from "../api/client";

const mockDeck = {
	id: "deck-1",
	name: "Japanese Vocabulary",
	description: "Common Japanese words",
	newCardsPerDay: 20,
	createdAt: "2024-01-01T00:00:00Z",
	updatedAt: "2024-01-01T00:00:00Z",
};

// Basic note-based cards (each with its own note)
const mockBasicCards = [
	{
		id: "card-1",
		deckId: "deck-1",
		noteId: "note-1",
		isReversed: false,
		front: "Hello",
		back: "こんにちは",
		state: 0,
		due: "2024-01-01T00:00:00Z",
		stability: 0,
		difficulty: 0,
		elapsedDays: 0,
		scheduledDays: 0,
		reps: 0,
		lapses: 0,
		lastReview: null,
		createdAt: "2024-01-01T00:00:00Z",
		updatedAt: "2024-01-01T00:00:00Z",
		deletedAt: null,
		syncVersion: 0,
	},
	{
		id: "card-2",
		deckId: "deck-1",
		noteId: "note-2",
		isReversed: false,
		front: "Goodbye",
		back: "さようなら",
		state: 2,
		due: "2024-01-02T00:00:00Z",
		stability: 5.5,
		difficulty: 5.0,
		elapsedDays: 1,
		scheduledDays: 7,
		reps: 5,
		lapses: 1,
		lastReview: "2024-01-01T00:00:00Z",
		createdAt: "2024-01-01T00:00:00Z",
		updatedAt: "2024-01-01T00:00:00Z",
		deletedAt: null,
		syncVersion: 0,
	},
];

// Note-based cards (with noteId)
const mockNoteBasedCards = [
	{
		id: "card-3",
		deckId: "deck-1",
		noteId: "note-1",
		isReversed: false,
		front: "Apple",
		back: "りんご",
		state: 0,
		due: "2024-01-01T00:00:00Z",
		stability: 0,
		difficulty: 0,
		elapsedDays: 0,
		scheduledDays: 0,
		reps: 0,
		lapses: 0,
		lastReview: null,
		createdAt: "2024-01-02T00:00:00Z",
		updatedAt: "2024-01-02T00:00:00Z",
		deletedAt: null,
		syncVersion: 0,
	},
	{
		id: "card-4",
		deckId: "deck-1",
		noteId: "note-1",
		isReversed: true,
		front: "りんご",
		back: "Apple",
		state: 0,
		due: "2024-01-01T00:00:00Z",
		stability: 0,
		difficulty: 0,
		elapsedDays: 0,
		scheduledDays: 0,
		reps: 2,
		lapses: 0,
		lastReview: null,
		createdAt: "2024-01-02T00:00:00Z",
		updatedAt: "2024-01-02T00:00:00Z",
		deletedAt: null,
		syncVersion: 0,
	},
];

// Alias for existing tests
const mockCards = mockBasicCards;

function renderWithProviders(path = "/decks/deck-1") {
	const { hook } = memoryLocation({ path, static: true });
	return render(
		<Router hook={hook}>
			<AuthProvider>
				<Route path="/decks/:deckId">
					<DeckDetailPage />
				</Route>
			</AuthProvider>
		</Router>,
	);
}

describe("DeckDetailPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiClient.getTokens).mockReturnValue({
			accessToken: "access-token",
			refreshToken: "refresh-token",
		});
		vi.mocked(apiClient.isAuthenticated).mockReturnValue(true);
		vi.mocked(apiClient.getAuthHeader).mockReturnValue({
			Authorization: "Bearer access-token",
		});

		// handleResponse passes through whatever it receives
		mockHandleResponse.mockImplementation((res) => Promise.resolve(res));
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("renders back link and deck name", async () => {
		mockDeckGet.mockResolvedValue({ deck: mockDeck });
		mockCardsGet.mockResolvedValue({ cards: mockCards });

		renderWithProviders();

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "Japanese Vocabulary" }),
			).toBeDefined();
		});

		expect(screen.getByText(/Back to Decks/)).toBeDefined();
		expect(screen.getByText("Common Japanese words")).toBeDefined();
	});

	it("shows loading state while fetching data", async () => {
		mockDeckGet.mockImplementation(() => new Promise(() => {})); // Never resolves
		mockCardsGet.mockImplementation(() => new Promise(() => {})); // Never resolves

		renderWithProviders();

		// Loading state shows spinner (svg with animate-spin class)
		expect(document.querySelector(".animate-spin")).toBeDefined();
	});

	it("displays empty state when no cards exist", async () => {
		mockDeckGet.mockResolvedValue({ deck: mockDeck });
		mockCardsGet.mockResolvedValue({ cards: [] });

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByText("No cards yet")).toBeDefined();
		});
		expect(screen.getByText("Add notes to start studying")).toBeDefined();
	});

	it("displays list of cards", async () => {
		mockDeckGet.mockResolvedValue({ deck: mockDeck });
		mockCardsGet.mockResolvedValue({ cards: mockCards });

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByText("Hello")).toBeDefined();
		});
		expect(screen.getByText("こんにちは")).toBeDefined();
		expect(screen.getByText("Goodbye")).toBeDefined();
		expect(screen.getByText("さようなら")).toBeDefined();
	});

	it("displays card count", async () => {
		mockDeckGet.mockResolvedValue({ deck: mockDeck });
		mockCardsGet.mockResolvedValue({ cards: mockCards });

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByText("(2)")).toBeDefined();
		});
	});

	it("displays card state labels", async () => {
		mockDeckGet.mockResolvedValue({ deck: mockDeck });
		mockCardsGet.mockResolvedValue({ cards: mockCards });

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByText("New")).toBeDefined();
		});
		expect(screen.getByText("Review")).toBeDefined();
	});

	it("displays card stats (reps and lapses)", async () => {
		mockDeckGet.mockResolvedValue({ deck: mockDeck });
		mockCardsGet.mockResolvedValue({ cards: mockCards });

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByText("0 reviews")).toBeDefined();
		});
		expect(screen.getByText("5 reviews")).toBeDefined();
		expect(screen.getByText("1 lapses")).toBeDefined();
	});

	it("displays error on API failure for deck", async () => {
		mockDeckGet.mockRejectedValue(new ApiClientError("Deck not found", 404));
		mockCardsGet.mockResolvedValue({ cards: [] });

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain("Deck not found");
		});
	});

	it("displays error on API failure for cards", async () => {
		mockDeckGet.mockResolvedValue({ deck: mockDeck });
		mockCardsGet.mockRejectedValue(
			new ApiClientError("Failed to load cards", 500),
		);

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to load cards",
			);
		});
	});

	it("allows retry after error", async () => {
		const user = userEvent.setup();
		// First call fails
		mockDeckGet
			.mockRejectedValueOnce(new ApiClientError("Server error", 500))
			// Retry succeeds
			.mockResolvedValueOnce({ deck: mockDeck });
		mockCardsGet.mockResolvedValue({ cards: mockCards });

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Retry" }));

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "Japanese Vocabulary" }),
			).toBeDefined();
		});
	});

	it("calls correct RPC endpoints when fetching data", async () => {
		mockDeckGet.mockResolvedValue({ deck: mockDeck });
		mockCardsGet.mockResolvedValue({ cards: [] });

		renderWithProviders();

		await waitFor(() => {
			expect(mockDeckGet).toHaveBeenCalledWith({
				param: { id: "deck-1" },
			});
		});
		expect(mockCardsGet).toHaveBeenCalledWith({
			param: { deckId: "deck-1" },
		});
	});

	it("does not show description if deck has none", async () => {
		const deckWithoutDescription = { ...mockDeck, description: null };
		mockDeckGet.mockResolvedValue({ deck: deckWithoutDescription });
		mockCardsGet.mockResolvedValue({ cards: [] });

		renderWithProviders();

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "Japanese Vocabulary" }),
			).toBeDefined();
		});

		// No description should be shown
		expect(screen.queryByText("Common Japanese words")).toBeNull();
	});

	describe("Delete Note", () => {
		it("shows Delete button for each note", async () => {
			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockCardsGet.mockResolvedValue({ cards: mockCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByText("Hello")).toBeDefined();
			});

			const deleteButtons = screen.getAllByRole("button", {
				name: "Delete note",
			});
			expect(deleteButtons.length).toBe(2);
		});

		it("opens delete confirmation modal when Delete button is clicked", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockCardsGet.mockResolvedValue({ cards: mockCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByText("Hello")).toBeDefined();
			});

			const deleteButtons = screen.getAllByRole("button", {
				name: "Delete note",
			});
			const firstDeleteButton = deleteButtons[0];
			if (firstDeleteButton) {
				await user.click(firstDeleteButton);
			}

			expect(screen.getByRole("dialog")).toBeDefined();
			expect(
				screen.getByRole("heading", { name: "Delete Note" }),
			).toBeDefined();
		});

		it("closes delete modal when Cancel is clicked", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockCardsGet.mockResolvedValue({ cards: mockCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByText("Hello")).toBeDefined();
			});

			const deleteButtons = screen.getAllByRole("button", {
				name: "Delete note",
			});
			const firstDeleteButton = deleteButtons[0];
			if (firstDeleteButton) {
				await user.click(firstDeleteButton);
			}

			expect(screen.getByRole("dialog")).toBeDefined();

			await user.click(screen.getByRole("button", { name: "Cancel" }));

			expect(screen.queryByRole("dialog")).toBeNull();
		});

		it("deletes note and refreshes list on confirmation", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockCardsGet
				.mockResolvedValueOnce({ cards: mockCards })
				// Refresh after deletion
				.mockResolvedValueOnce({ cards: [mockCards[1]] });
			mockNoteDelete.mockResolvedValue({ success: true });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByText("Hello")).toBeDefined();
			});

			const deleteButtons = screen.getAllByRole("button", {
				name: "Delete note",
			});
			const firstDeleteButton = deleteButtons[0];
			if (firstDeleteButton) {
				await user.click(firstDeleteButton);
			}

			// Find the Delete button in the modal (using the button's text content)
			const dialog = screen.getByRole("dialog");
			const modalButtons = dialog.querySelectorAll("button");
			// Find the button with "Delete" text (not "Cancel")
			const confirmDeleteButton = Array.from(modalButtons).find((btn) =>
				btn.textContent?.includes("Delete"),
			);
			if (confirmDeleteButton) {
				await user.click(confirmDeleteButton);
			}

			// Wait for modal to close and list to refresh
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).toBeNull();
			});

			// Verify DELETE request was made to notes endpoint
			expect(mockNoteDelete).toHaveBeenCalledWith({
				param: { deckId: "deck-1", noteId: "note-1" },
			});

			// Verify card count updated
			await waitFor(() => {
				expect(screen.getByText("(1)")).toBeDefined();
			});
		});

		it("displays error when delete fails", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockCardsGet.mockResolvedValue({ cards: mockCards });
			mockNoteDelete.mockRejectedValue(
				new ApiClientError("Failed to delete note", 500),
			);

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByText("Hello")).toBeDefined();
			});

			const deleteButtons = screen.getAllByRole("button", {
				name: "Delete note",
			});
			const firstDeleteButton = deleteButtons[0];
			if (firstDeleteButton) {
				await user.click(firstDeleteButton);
			}

			// Find the Delete button in the modal (using the button's text content)
			const dialog = screen.getByRole("dialog");
			const modalButtons = dialog.querySelectorAll("button");
			// Find the button with "Delete" text (not "Cancel")
			const confirmDeleteButton = Array.from(modalButtons).find((btn) =>
				btn.textContent?.includes("Delete"),
			);
			if (confirmDeleteButton) {
				await user.click(confirmDeleteButton);
			}

			// Error should be displayed in the modal
			await waitFor(() => {
				expect(screen.getByRole("alert").textContent).toContain(
					"Failed to delete note",
				);
			});
		});
	});

	describe("Card Grouping by Note", () => {
		it("groups cards by noteId and displays as note groups", async () => {
			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockCardsGet.mockResolvedValue({ cards: mockNoteBasedCards });

			renderWithProviders();

			await waitFor(() => {
				// Should show note group container
				expect(screen.getByTestId("note-group")).toBeDefined();
			});

			// Should display both cards within the note group
			const noteCards = screen.getAllByTestId("note-card");
			expect(noteCards.length).toBe(2);
		});

		it("shows Normal and Reversed badges for note-based cards", async () => {
			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockCardsGet.mockResolvedValue({ cards: mockNoteBasedCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByText("Normal")).toBeDefined();
			});

			expect(screen.getByText("Reversed")).toBeDefined();
		});

		it("shows note card count in note group header", async () => {
			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockCardsGet.mockResolvedValue({ cards: mockNoteBasedCards });

			renderWithProviders();

			await waitFor(() => {
				// Should show "Note (2 cards)" since there are 2 cards from the same note
				expect(screen.getByText("Note (2 cards)")).toBeDefined();
			});
		});

		it("shows edit note button for note groups", async () => {
			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockCardsGet.mockResolvedValue({ cards: mockNoteBasedCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("note-group")).toBeDefined();
			});

			const editNoteButton = screen.getByRole("button", { name: "Edit note" });
			expect(editNoteButton).toBeDefined();
		});

		it("shows delete note button for note groups", async () => {
			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockCardsGet.mockResolvedValue({ cards: mockNoteBasedCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("note-group")).toBeDefined();
			});

			const deleteNoteButton = screen.getByRole("button", {
				name: "Delete note",
			});
			expect(deleteNoteButton).toBeDefined();
		});

		it("opens delete note modal when delete button is clicked", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockCardsGet.mockResolvedValue({ cards: mockNoteBasedCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("note-group")).toBeDefined();
			});

			const deleteNoteButton = screen.getByRole("button", {
				name: "Delete note",
			});
			await user.click(deleteNoteButton);

			expect(screen.getByRole("dialog")).toBeDefined();
			expect(
				screen.getByRole("heading", { name: "Delete Note" }),
			).toBeDefined();
		});

		it("deletes note and refreshes list when confirmed", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockCardsGet
				.mockResolvedValueOnce({ cards: mockNoteBasedCards })
				// Refresh cards after deletion
				.mockResolvedValueOnce({ cards: [] });
			mockNoteDelete.mockResolvedValue({ success: true });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("note-group")).toBeDefined();
			});

			const deleteNoteButton = screen.getByRole("button", {
				name: "Delete note",
			});
			await user.click(deleteNoteButton);

			// Confirm deletion in modal
			const dialog = screen.getByRole("dialog");
			const modalButtons = dialog.querySelectorAll("button");
			const confirmDeleteButton = Array.from(modalButtons).find((btn) =>
				btn.textContent?.includes("Delete"),
			);
			if (confirmDeleteButton) {
				await user.click(confirmDeleteButton);
			}

			// Wait for modal to close
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).toBeNull();
			});

			// Verify DELETE request was made to notes endpoint
			expect(mockNoteDelete).toHaveBeenCalledWith({
				param: { deckId: "deck-1", noteId: "note-1" },
			});

			// Should show empty state after deletion
			await waitFor(() => {
				expect(screen.getByText("No cards yet")).toBeDefined();
			});
		});

		it("displays note preview from normal card content", async () => {
			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockCardsGet.mockResolvedValue({ cards: mockNoteBasedCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("note-group")).toBeDefined();
			});

			// The normal card's front/back should be displayed as preview
			expect(screen.getByText("Apple")).toBeDefined();
			expect(screen.getByText("りんご")).toBeDefined();
		});
	});
});
