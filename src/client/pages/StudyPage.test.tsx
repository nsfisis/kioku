/**
 * @vitest-environment jsdom
 */
import { QueryClient } from "@tanstack/query-core";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import {
	authLoadingAtom,
	isOnlineAtom,
	type StudyCard,
	type StudyData,
} from "../atoms";
import type { LocalCard } from "../db";
import { StudyPage } from "./StudyPage";

interface RenderOptions {
	path?: string;
	initialStudyData?: StudyData;
	online?: boolean;
}

const mockSubmitReview = vi.fn();
const mockUndoReview = vi.fn();
const mockTriggerSync = vi.fn();

vi.mock(import("../sync"), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		submitReviewLocal: (args: Parameters<typeof actual.submitReviewLocal>[0]) =>
			mockSubmitReview(args),
		undoReviewLocal: (args: Parameters<typeof actual.undoReviewLocal>[0]) =>
			mockUndoReview(args),
		cacheStudyCards: vi.fn().mockResolvedValue(undefined),
	};
});

vi.mock(import("../atoms"), async (importOriginal) => {
	const actual = await importOriginal();
	const { atom } = await import("jotai");
	const stubSync = atom(null, async () => {
		mockTriggerSync();
		return {
			success: true,
			pushResult: null,
			pullResult: null,
			conflictsResolved: 0,
			crdtDocumentsStored: 0,
		};
	});
	return {
		...actual,
		syncActionAtom: stubSync as unknown as typeof actual.syncActionAtom,
	};
});

const mockEditNoteModalOnClose = vi.fn();
const mockEditNoteModalOnNoteUpdated = vi.fn();

vi.mock("../components/EditNoteModal", () => ({
	EditNoteModal: ({
		isOpen,
		deckId,
		noteId,
		onClose,
		onNoteUpdated,
	}: {
		isOpen: boolean;
		deckId: string;
		noteId: string | null;
		onClose: () => void;
		onNoteUpdated: () => void;
	}) => {
		mockEditNoteModalOnClose.mockImplementation(onClose);
		mockEditNoteModalOnNoteUpdated.mockImplementation(onNoteUpdated);

		if (!isOpen) return null;
		return (
			<div
				data-testid="edit-note-modal"
				data-deck-id={deckId}
				data-note-id={noteId}
			>
				<button type="button" data-testid="edit-modal-close" onClick={onClose}>
					Cancel
				</button>
				<button
					type="button"
					data-testid="edit-modal-save"
					onClick={onNoteUpdated}
				>
					Save Changes
				</button>
			</div>
		);
	},
}));

vi.mock("../api/client", () => ({
	apiClient: {
		login: vi.fn(),
		logout: vi.fn(),
		getTokens: vi.fn(),
		getAuthHeader: vi.fn(),
		onSessionExpired: vi.fn(() => vi.fn()),
		rpc: { api: { decks: {} } },
		handleResponse: vi.fn(),
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

let testQueryClient: QueryClient;

const mockDeck = {
	id: "deck-1",
	name: "Japanese Vocabulary",
};

function makeStudyCard(overrides: Partial<StudyCard>): StudyCard {
	return {
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
		noteType: { frontTemplate: "{{Front}}", backTemplate: "{{Back}}" },
		fieldValuesMap: { Front: "Hello", Back: "こんにちは" },
		...overrides,
	};
}

const mockFirstCard = makeStudyCard({});
const mockSecondCard = makeStudyCard({
	id: "card-2",
	noteId: "note-2",
	front: "Goodbye",
	back: "さようなら",
	fieldValuesMap: { Front: "Goodbye", Back: "さようなら" },
});
const mockThirdCard = makeStudyCard({
	id: "card-3",
	noteId: "note-3",
	front: "Thank you",
	back: "ありがとう",
	fieldValuesMap: { Front: "Thank you", Back: "ありがとう" },
});

const mockDueCards: StudyCard[] = [mockFirstCard, mockSecondCard];

function makeLocalCard(id: string): LocalCard {
	return {
		id,
		deckId: "deck-1",
		noteId: `note-${id}`,
		isReversed: false,
		front: "",
		back: "",
		state: 0,
		due: new Date("2024-01-01T00:00:00Z"),
		stability: 0,
		difficulty: 0,
		elapsedDays: 0,
		scheduledDays: 0,
		reps: 0,
		lapses: 0,
		lastReview: null,
		createdAt: new Date("2024-01-01T00:00:00Z"),
		updatedAt: new Date("2024-01-01T00:00:00Z"),
		deletedAt: null,
		syncVersion: 0,
		_synced: true,
	};
}

function renderWithProviders({
	path = "/decks/deck-1/study",
	initialStudyData,
	online = true,
}: RenderOptions = {}) {
	const { hook } = memoryLocation({ path, static: true });
	const store = createStore();
	store.set(authLoadingAtom, false);
	store.set(queryClientAtom, testQueryClient);
	store.set(isOnlineAtom, online);

	const deckIdMatch = path.match(/\/decks\/([^/]+)/);
	const deckId = deckIdMatch?.[1] ?? "deck-1";

	if (initialStudyData !== undefined) {
		testQueryClient.setQueryData(["decks", deckId, "study"], initialStudyData);
	}

	return render(
		<Provider store={store}>
			<Router hook={hook}>
				<Route path="/decks/:deckId/study">
					<StudyPage />
				</Route>
			</Router>
		</Provider>,
	);
}

describe("StudyPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		testQueryClient = new QueryClient({
			defaultOptions: {
				queries: { staleTime: Number.POSITIVE_INFINITY, retry: false },
			},
		});

		mockSubmitReview.mockImplementation(
			async ({ cardId }: { cardId: string }) => ({
				card: makeLocalCard(cardId),
				prevCard: makeLocalCard(cardId),
				reviewLogId: `log-${cardId}`,
			}),
		);
		mockUndoReview.mockResolvedValue(undefined);
		mockTriggerSync.mockResolvedValue(undefined);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		testQueryClient.clear();
	});

	describe("Loading and Initial State", () => {
		it("renders deck name and back link", () => {
			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			expect(
				screen.getByRole("heading", { name: /Japanese Vocabulary/ }),
			).toBeDefined();
			expect(screen.getByText(/Back to Deck/)).toBeDefined();
		});
	});

	describe("No Cards State", () => {
		it("shows no cards message when deck has no due cards", () => {
			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: [] },
			});

			expect(screen.getByTestId("no-cards")).toBeDefined();
			expect(screen.getByText("All caught up!")).toBeDefined();
		});
	});

	describe("Card Display and Progress", () => {
		it("shows remaining cards count", () => {
			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			expect(screen.getByTestId("remaining-count").textContent).toBe(
				"2 remaining",
			);
		});

		it("displays the front of the first card", () => {
			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			expect(screen.getByTestId("card-front").textContent).toBe("Hello");
		});

		it("does not show rating buttons before card is flipped", () => {
			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			expect(screen.queryByTestId("rating-buttons")).toBeNull();
		});
	});

	describe("Card Flip Interaction", () => {
		it("reveals answer when card is clicked", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.click(screen.getByTestId("card-container"));

			expect(screen.getByTestId("card-back").textContent).toBe("こんにちは");
		});

		it("shows rating buttons after card is flipped", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.click(screen.getByTestId("card-container"));

			expect(screen.getByTestId("rating-buttons")).toBeDefined();
			expect(screen.getByTestId("rating-1")).toBeDefined();
			expect(screen.getByTestId("rating-4")).toBeDefined();
		});

		it("displays rating labels on buttons", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.click(screen.getByTestId("card-container"));

			expect(screen.getByTestId("rating-1").textContent).toContain("Again");
			expect(screen.getByTestId("rating-2").textContent).toContain("Hard");
			expect(screen.getByTestId("rating-3").textContent).toContain("Good");
			expect(screen.getByTestId("rating-4").textContent).toContain("Easy");
		});
	});

	describe("Rating Submission", () => {
		it("submits review locally and advances to next card", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Goodbye");
			});

			expect(mockSubmitReview).toHaveBeenCalledTimes(1);
			expect(mockSubmitReview).toHaveBeenCalledWith(
				expect.objectContaining({ cardId: "card-1", rating: 3 }),
			);
		});

		it("triggers sync when online", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
				online: true,
			});

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(mockTriggerSync).toHaveBeenCalled();
			});
		});

		it("does not trigger sync when offline", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
				online: false,
			});

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Goodbye");
			});

			expect(mockTriggerSync).not.toHaveBeenCalled();
		});

		it("still advances even when offline", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
				online: false,
			});

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Goodbye");
			});
			expect(mockSubmitReview).toHaveBeenCalledTimes(1);
		});

		it("updates remaining count after review", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			expect(screen.getByTestId("remaining-count").textContent).toBe(
				"2 remaining",
			);

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(screen.getByTestId("remaining-count").textContent).toBe(
					"1 remaining",
				);
			});
		});

		it("shows error when local review submission fails", async () => {
			const user = userEvent.setup();

			mockSubmitReview.mockRejectedValueOnce(
				new Error("Failed to submit review"),
			);

			renderWithProviders({
				initialStudyData: {
					deck: mockDeck,
					cards: [mockFirstCard, mockSecondCard, mockThirdCard],
				},
			});

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(screen.getByRole("alert").textContent).toContain(
					"Failed to submit review",
				);
			});

			// Failed review should not advance — count stays at 3.
			expect(screen.getByTestId("remaining-count").textContent).toBe(
				"3 remaining",
			);
		});
	});

	describe("Session Complete", () => {
		it("shows session complete screen after all cards reviewed", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: [mockFirstCard] },
			});

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(screen.getByTestId("session-complete")).toBeDefined();
			});
			expect(screen.getByTestId("completed-count").textContent).toBe("1");
		});

		it("provides navigation links after session complete", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: [mockFirstCard] },
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

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.keyboard(" ");

			expect(screen.getByTestId("card-back").textContent).toBe("こんにちは");
		});

		it("flips card with Enter key", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.keyboard("{Enter}");

			expect(screen.getByTestId("card-back").textContent).toBe("こんにちは");
		});

		it("rates card with number keys", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.keyboard(" ");
			await user.keyboard("3");

			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Goodbye");
			});

			expect(mockSubmitReview).toHaveBeenCalledWith(
				expect.objectContaining({ rating: 3 }),
			);
		});

		it("rates card as Good with Space key when card is flipped", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.keyboard(" ");
			await user.keyboard(" ");

			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Goodbye");
			});

			expect(mockSubmitReview).toHaveBeenCalledWith(
				expect.objectContaining({ rating: 3 }),
			);
		});
	});

	describe("Undo", () => {
		it("does not show undo button before any rating", () => {
			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			expect(screen.queryByTestId("undo-button")).toBeNull();
		});

		it("shows undo button after rating (when not flipped)", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Goodbye");
			});

			expect(screen.getByTestId("undo-button")).toBeDefined();
		});

		it("undoes the last rating and returns to previous card", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Goodbye");
			});

			await user.click(screen.getByTestId("undo-button"));

			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Hello");
			});

			expect(mockUndoReview).toHaveBeenCalledTimes(1);
			expect(screen.queryByTestId("undo-button")).toBeNull();
		});

		it("decrements completed count on undo", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: {
					deck: mockDeck,
					cards: [mockFirstCard, mockSecondCard, mockThirdCard],
				},
			});

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Goodbye");
			});
			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-4"));

			await waitFor(() => {
				expect(screen.getByTestId("remaining-count").textContent).toBe(
					"1 remaining",
				);
			});

			await user.click(screen.getByTestId("undo-button"));

			await waitFor(() => {
				expect(screen.getByTestId("remaining-count").textContent).toBe(
					"2 remaining",
				);
			});
		});

		it("undoes with z key when card is not flipped", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Goodbye");
			});

			await user.keyboard("z");

			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Hello");
			});
		});

		it("undoes with Ctrl+Z", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Goodbye");
			});

			await user.keyboard("{Control>}z{/Control}");

			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Hello");
			});
		});

		it("shows undo button on session complete screen", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: [mockFirstCard] },
			});

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(screen.getByTestId("session-complete")).toBeDefined();
			});

			expect(screen.getByTestId("undo-button")).toBeDefined();
		});

		it("undoes from session complete screen back to last card", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: [mockFirstCard] },
			});

			await user.click(screen.getByTestId("card-container"));
			await user.click(screen.getByTestId("rating-3"));

			await waitFor(() => {
				expect(screen.getByTestId("session-complete")).toBeDefined();
			});

			await user.click(screen.getByTestId("undo-button"));

			await waitFor(() => {
				expect(screen.getByTestId("card-front").textContent).toBe("Hello");
			});
			expect(screen.queryByTestId("session-complete")).toBeNull();
		});
	});

	describe("Edit Card", () => {
		it("shows edit button on card", () => {
			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			expect(screen.getByTestId("edit-card-button")).toBeDefined();
		});

		it("opens edit modal when edit button is clicked", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.click(screen.getByTestId("edit-card-button"));

			expect(screen.getByTestId("edit-note-modal")).toBeDefined();
			expect(
				screen.getByTestId("edit-note-modal").getAttribute("data-note-id"),
			).toBe("note-1");
		});

		it("does not flip card when edit button is clicked", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.click(screen.getByTestId("edit-card-button"));

			expect(screen.getByTestId("card-front")).toBeDefined();
			expect(screen.queryByTestId("card-back")).toBeNull();
		});

		it("closes edit modal when close button is clicked", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.click(screen.getByTestId("edit-card-button"));
			await user.click(screen.getByTestId("edit-modal-close"));

			expect(screen.queryByTestId("edit-note-modal")).toBeNull();
		});

		it("opens edit modal with E key", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.keyboard("e");

			expect(screen.getByTestId("edit-note-modal")).toBeDefined();
		});

		it("disables keyboard shortcuts while edit modal is open", async () => {
			const user = userEvent.setup();

			renderWithProviders({
				initialStudyData: { deck: mockDeck, cards: mockDueCards },
			});

			await user.keyboard("e");
			expect(screen.getByTestId("edit-note-modal")).toBeDefined();

			await user.keyboard(" ");
			expect(screen.getByTestId("card-front")).toBeDefined();
			expect(screen.queryByTestId("card-back")).toBeNull();
		});
	});
});
