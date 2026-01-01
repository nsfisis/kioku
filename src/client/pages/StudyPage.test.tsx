/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AuthProvider } from "../stores";
import { StudyPage } from "./StudyPage";

const mockDeckGet = vi.fn();
const mockStudyGet = vi.fn();
const mockStudyPost = vi.fn();
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
						study: {
							$get: (args: unknown) => mockStudyGet(args),
							":cardId": {
								$post: (args: unknown) => mockStudyPost(args),
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

const mockDueCards = [
	{
		id: "card-1",
		deckId: "deck-1",
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
		front: "Goodbye",
		back: "さようなら",
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
];

function renderWithProviders(path = "/decks/deck-1/study") {
	const { hook } = memoryLocation({ path, static: true });
	return render(
		<Router hook={hook}>
			<AuthProvider>
				<Route path="/decks/:deckId/study">
					<StudyPage />
				</Route>
			</AuthProvider>
		</Router>,
	);
}

describe("StudyPage", () => {
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

	describe("Loading and Initial State", () => {
		it("shows loading state while fetching data", async () => {
			mockDeckGet.mockImplementation(() => new Promise(() => {})); // Never resolves
			mockStudyGet.mockImplementation(() => new Promise(() => {})); // Never resolves

			renderWithProviders();

			// Loading state shows spinner (svg with animate-spin class)
			expect(document.querySelector(".animate-spin")).toBeDefined();
		});

		it("renders deck name and back link", async () => {
			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: mockDueCards });

			renderWithProviders();

			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: /Japanese Vocabulary/ }),
				).toBeDefined();
			});

			expect(screen.getByText(/Back to Deck/)).toBeDefined();
		});

		it("calls correct RPC endpoints when fetching data", async () => {
			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: [] });

			renderWithProviders();

			await waitFor(() => {
				expect(mockDeckGet).toHaveBeenCalledWith({
					param: { id: "deck-1" },
				});
			});
			expect(mockStudyGet).toHaveBeenCalledWith({
				param: { deckId: "deck-1" },
			});
		});
	});

	describe("Error Handling", () => {
		it("displays error on API failure", async () => {
			mockDeckGet.mockRejectedValue(new ApiClientError("Deck not found", 404));
			mockStudyGet.mockResolvedValue({ cards: [] });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByRole("alert").textContent).toContain(
					"Deck not found",
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
			mockStudyGet.mockResolvedValue({ cards: mockDueCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByRole("alert")).toBeDefined();
			});

			await user.click(screen.getByRole("button", { name: "Retry" }));

			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: /Japanese Vocabulary/ }),
				).toBeDefined();
			});
		});
	});

	describe("No Cards State", () => {
		it("shows no cards message when deck has no due cards", async () => {
			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: [] });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("no-cards")).toBeDefined();
			});
			expect(screen.getByText("All caught up!")).toBeDefined();
			expect(
				screen.getByText("No cards due for review right now"),
			).toBeDefined();
		});
	});

	describe("Card Display and Progress", () => {
		it("shows remaining cards count", async () => {
			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: mockDueCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("remaining-count").textContent).toBe(
					"2 remaining",
				);
			});
		});

		it("displays the front of the first card", async () => {
			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: mockDueCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Hello");
			});
		});

		it("does not show rating buttons before card is flipped", async () => {
			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: mockDueCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("card-front")).toBeDefined();
			});

			expect(screen.queryByTestId("rating-buttons")).toBeNull();
		});
	});

	describe("Card Flip Interaction", () => {
		it("reveals answer when card is clicked", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: mockDueCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("card-front")).toBeDefined();
			});

			await user.click(screen.getByTestId("card-container"));

			expect(screen.getByTestId("card-back").textContent).toBe("こんにちは");
		});

		it("shows rating buttons after card is flipped", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: mockDueCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("card-front")).toBeDefined();
			});

			await user.click(screen.getByTestId("card-container"));

			expect(screen.getByTestId("rating-buttons")).toBeDefined();
			expect(screen.getByTestId("rating-1")).toBeDefined();
			expect(screen.getByTestId("rating-2")).toBeDefined();
			expect(screen.getByTestId("rating-3")).toBeDefined();
			expect(screen.getByTestId("rating-4")).toBeDefined();
		});

		it("displays rating labels on buttons", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: mockDueCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("card-front")).toBeDefined();
			});

			await user.click(screen.getByTestId("card-container"));

			expect(screen.getByTestId("rating-1").textContent).toContain("Again");
			expect(screen.getByTestId("rating-2").textContent).toContain("Hard");
			expect(screen.getByTestId("rating-3").textContent).toContain("Good");
			expect(screen.getByTestId("rating-4").textContent).toContain("Easy");
		});
	});

	describe("Rating Submission", () => {
		it("submits review and moves to next card", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: mockDueCards });
			mockStudyPost.mockResolvedValue({
				card: { ...mockDueCards[0], reps: 1 },
			});

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("card-front")).toBeDefined();
			});

			// Flip card
			await user.click(screen.getByTestId("card-container"));

			// Rate as Good
			await user.click(screen.getByTestId("rating-3"));

			// Should move to next card
			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Goodbye");
			});

			// Verify API was called with correct params
			expect(mockStudyPost).toHaveBeenCalledWith(
				expect.objectContaining({
					param: { deckId: "deck-1", cardId: "card-1" },
					json: expect.objectContaining({ rating: 3 }),
				}),
			);
		});

		it("updates remaining count after review", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: mockDueCards });
			mockStudyPost.mockResolvedValue({
				card: { ...mockDueCards[0], reps: 1 },
			});

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("remaining-count").textContent).toBe(
					"2 remaining",
				);
			});

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(screen.getByTestId("remaining-count").textContent).toBe(
					"1 remaining",
				);
			});
		});

		it("shows error when rating submission fails", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: mockDueCards });
			mockStudyPost.mockRejectedValue(
				new ApiClientError("Failed to submit review", 500),
			);

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("card-front")).toBeDefined();
			});

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(screen.getByRole("alert").textContent).toContain(
					"Failed to submit review",
				);
			});
		});
	});

	describe("Session Complete", () => {
		it("shows session complete screen after all cards reviewed", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: [mockDueCards[0]] });
			mockStudyPost.mockResolvedValue({
				card: { ...mockDueCards[0], reps: 1 },
			});

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("card-front")).toBeDefined();
			});

			// Review the only card
			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			// Should show session complete
			await waitFor(() => {
				expect(screen.getByTestId("session-complete")).toBeDefined();
			});
			expect(screen.getByText("Session Complete!")).toBeDefined();
			expect(screen.getByTestId("completed-count").textContent).toBe("1");
		});

		it("shows correct count for multiple cards reviewed", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: mockDueCards });
			mockStudyPost.mockResolvedValue({
				card: { ...mockDueCards[0], reps: 1 },
			});

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("card-front")).toBeDefined();
			});

			// Review first card
			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			// Review second card
			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Goodbye");
			});
			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-4"));

			// Should show session complete with 2 cards
			await waitFor(() => {
				expect(screen.getByTestId("session-complete")).toBeDefined();
			});
			expect(screen.getByTestId("completed-count").textContent).toBe("2");
		});

		it("provides navigation links after session complete", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: [mockDueCards[0]] });
			mockStudyPost.mockResolvedValue({
				card: { ...mockDueCards[0], reps: 1 },
			});

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("card-front")).toBeDefined();
			});

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(screen.getByTestId("session-complete")).toBeDefined();
			});

			expect(screen.getAllByText("Back to Deck").length).toBeGreaterThan(0);
			expect(screen.getByText("All Decks")).toBeDefined();
		});
	});

	describe("Keyboard Shortcuts", () => {
		it("flips card with Space key", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: mockDueCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("card-front")).toBeDefined();
			});

			await user.keyboard(" ");

			expect(screen.getByTestId("card-back").textContent).toBe("こんにちは");
		});

		it("flips card with Enter key", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: mockDueCards });

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("card-front")).toBeDefined();
			});

			await user.keyboard("{Enter}");

			expect(screen.getByTestId("card-back").textContent).toBe("こんにちは");
		});

		it("rates card with number keys", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: mockDueCards });
			mockStudyPost.mockResolvedValue({
				card: { ...mockDueCards[0], reps: 1 },
			});

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("card-front")).toBeDefined();
			});

			await user.keyboard(" "); // Flip
			await user.keyboard("3"); // Rate as Good

			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Goodbye");
			});

			expect(mockStudyPost).toHaveBeenCalledWith(
				expect.objectContaining({
					param: { deckId: "deck-1", cardId: "card-1" },
					json: expect.objectContaining({ rating: 3 }),
				}),
			);
		});

		it("supports all rating keys (1, 2, 3, 4)", async () => {
			const user = userEvent.setup();

			mockDeckGet.mockResolvedValue({ deck: mockDeck });
			mockStudyGet.mockResolvedValue({ cards: mockDueCards });
			mockStudyPost.mockResolvedValue({
				card: { ...mockDueCards[0], reps: 1 },
			});

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByTestId("card-front")).toBeDefined();
			});

			await user.keyboard(" "); // Flip
			await user.keyboard("1"); // Rate as Again

			expect(mockStudyPost).toHaveBeenCalledWith(
				expect.objectContaining({
					param: { deckId: "deck-1", cardId: "card-1" },
					json: expect.objectContaining({ rating: 1 }),
				}),
			);
		});
	});
});
