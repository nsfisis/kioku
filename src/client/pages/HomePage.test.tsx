/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { apiClient } from "../api/client";
import { AuthProvider, SyncProvider } from "../stores";
import { HomePage } from "./HomePage";

vi.mock("../api/client", () => ({
	apiClient: {
		login: vi.fn(),
		logout: vi.fn(),
		isAuthenticated: vi.fn(),
		getTokens: vi.fn(),
		getAuthHeader: vi.fn(),
		rpc: {
			api: {
				decks: {
					$get: vi.fn(),
					$post: vi.fn(),
				},
			},
		},
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

// Mock fetch globally for Edit/Delete modals
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock responses compatible with Hono's ClientResponse
function mockResponse(data: {
	ok: boolean;
	status?: number;
	// biome-ignore lint/suspicious/noExplicitAny: Test helper needs flexible typing
	json: () => Promise<any>;
}) {
	return data as unknown as Awaited<
		ReturnType<typeof apiClient.rpc.api.decks.$get>
	>;
}

function mockPostResponse(data: {
	ok: boolean;
	status?: number;
	// biome-ignore lint/suspicious/noExplicitAny: Test helper needs flexible typing
	json: () => Promise<any>;
}) {
	return data as unknown as Awaited<
		ReturnType<typeof apiClient.rpc.api.decks.$post>
	>;
}

const mockDecks = [
	{
		id: "deck-1",
		name: "Japanese Vocabulary",
		description: "Common Japanese words",
		newCardsPerDay: 20,
		createdAt: "2024-01-01T00:00:00Z",
		updatedAt: "2024-01-01T00:00:00Z",
	},
	{
		id: "deck-2",
		name: "Spanish Verbs",
		description: null,
		newCardsPerDay: 10,
		createdAt: "2024-01-02T00:00:00Z",
		updatedAt: "2024-01-02T00:00:00Z",
	},
];

function renderWithProviders(path = "/") {
	const { hook } = memoryLocation({ path });
	return render(
		<Router hook={hook}>
			<AuthProvider>
				<SyncProvider>
					<HomePage />
				</SyncProvider>
			</AuthProvider>
		</Router>,
	);
}

describe("HomePage", () => {
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
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("renders page title and logout button", async () => {
		vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
			mockResponse({
				ok: true,
				json: async () => ({ decks: [] }),
			}),
		);

		renderWithProviders();

		expect(screen.getByRole("heading", { name: "Kioku" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Logout" })).toBeDefined();
	});

	it("shows loading state while fetching decks", async () => {
		vi.mocked(apiClient.rpc.api.decks.$get).mockImplementation(
			() => new Promise(() => {}), // Never resolves
		);

		renderWithProviders();

		expect(screen.getByText("Loading decks...")).toBeDefined();
	});

	it("displays empty state when no decks exist", async () => {
		vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
			mockResponse({
				ok: true,
				json: async () => ({ decks: [] }),
			}),
		);

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByText("You don't have any decks yet.")).toBeDefined();
		});
		expect(
			screen.getByText("Create your first deck to start learning!"),
		).toBeDefined();
	});

	it("displays list of decks", async () => {
		vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
			mockResponse({
				ok: true,
				json: async () => ({ decks: mockDecks }),
			}),
		);

		renderWithProviders();

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "Japanese Vocabulary" }),
			).toBeDefined();
		});
		expect(
			screen.getByRole("heading", { name: "Spanish Verbs" }),
		).toBeDefined();
		expect(screen.getByText("Common Japanese words")).toBeDefined();
	});

	it("displays error on API failure", async () => {
		vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
			mockResponse({
				ok: false,
				status: 500,
				json: async () => ({ error: "Internal server error" }),
			}),
		);

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Internal server error",
			);
		});
	});

	it("displays generic error on unexpected failure", async () => {
		vi.mocked(apiClient.rpc.api.decks.$get).mockRejectedValue(
			new Error("Network error"),
		);

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to load decks. Please try again.",
			);
		});
	});

	it("allows retry after error", async () => {
		const user = userEvent.setup();
		vi.mocked(apiClient.rpc.api.decks.$get)
			.mockResolvedValueOnce(
				mockResponse({
					ok: false,
					status: 500,
					json: async () => ({ error: "Server error" }),
				}),
			)
			.mockResolvedValueOnce(
				mockResponse({
					ok: true,
					json: async () => ({ decks: mockDecks }),
				}),
			);

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

	it("calls logout when logout button is clicked", async () => {
		const user = userEvent.setup();
		vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
			mockResponse({
				ok: true,
				json: async () => ({ decks: [] }),
			}),
		);

		renderWithProviders();

		await waitFor(() => {
			expect(screen.queryByText("Loading decks...")).toBeNull();
		});

		await user.click(screen.getByRole("button", { name: "Logout" }));

		expect(apiClient.logout).toHaveBeenCalled();
	});

	it("does not show description if deck has none", async () => {
		vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
			mockResponse({
				ok: true,
				json: async () => ({
					decks: [
						{
							id: "deck-1",
							name: "No Description Deck",
							description: null,
							newCardsPerDay: 20,
							createdAt: "2024-01-01T00:00:00Z",
							updatedAt: "2024-01-01T00:00:00Z",
						},
					],
				}),
			}),
		);

		renderWithProviders();

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "No Description Deck" }),
			).toBeDefined();
		});

		// The deck item should only contain the heading, no description paragraph
		const deckItem = screen
			.getByRole("heading", { name: "No Description Deck" })
			.closest("li");
		expect(deckItem?.querySelectorAll("p").length).toBe(0);
	});

	it("passes auth header when fetching decks", async () => {
		vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
			mockResponse({
				ok: true,
				json: async () => ({ decks: [] }),
			}),
		);

		renderWithProviders();

		await waitFor(() => {
			expect(apiClient.rpc.api.decks.$get).toHaveBeenCalledWith(undefined, {
				headers: { Authorization: "Bearer access-token" },
			});
		});
	});

	describe("Create Deck", () => {
		it("shows Create Deck button", async () => {
			vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
				mockResponse({
					ok: true,
					json: async () => ({ decks: [] }),
				}),
			);

			renderWithProviders();

			await waitFor(() => {
				expect(screen.queryByText("Loading decks...")).toBeNull();
			});

			expect(screen.getByRole("button", { name: "Create Deck" })).toBeDefined();
		});

		it("opens modal when Create Deck button is clicked", async () => {
			const user = userEvent.setup();
			vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
				mockResponse({
					ok: true,
					json: async () => ({ decks: [] }),
				}),
			);

			renderWithProviders();

			await waitFor(() => {
				expect(screen.queryByText("Loading decks...")).toBeNull();
			});

			await user.click(screen.getByRole("button", { name: "Create Deck" }));

			expect(screen.getByRole("dialog")).toBeDefined();
			expect(
				screen.getByRole("heading", { name: "Create New Deck" }),
			).toBeDefined();
		});

		it("closes modal when Cancel is clicked", async () => {
			const user = userEvent.setup();
			vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
				mockResponse({
					ok: true,
					json: async () => ({ decks: [] }),
				}),
			);

			renderWithProviders();

			await waitFor(() => {
				expect(screen.queryByText("Loading decks...")).toBeNull();
			});

			await user.click(screen.getByRole("button", { name: "Create Deck" }));
			expect(screen.getByRole("dialog")).toBeDefined();

			await user.click(screen.getByRole("button", { name: "Cancel" }));

			expect(screen.queryByRole("dialog")).toBeNull();
		});

		it("creates deck and refreshes list", async () => {
			const user = userEvent.setup();
			const newDeck = {
				id: "deck-new",
				name: "New Deck",
				description: "A new deck",
				newCardsPerDay: 20,
				createdAt: "2024-01-03T00:00:00Z",
				updatedAt: "2024-01-03T00:00:00Z",
			};

			vi.mocked(apiClient.rpc.api.decks.$get)
				.mockResolvedValueOnce(
					mockResponse({
						ok: true,
						json: async () => ({ decks: [] }),
					}),
				)
				.mockResolvedValueOnce(
					mockResponse({
						ok: true,
						json: async () => ({ decks: [newDeck] }),
					}),
				);

			vi.mocked(apiClient.rpc.api.decks.$post).mockResolvedValue(
				mockPostResponse({
					ok: true,
					json: async () => ({ deck: newDeck }),
				}),
			);

			renderWithProviders();

			await waitFor(() => {
				expect(screen.queryByText("Loading decks...")).toBeNull();
			});

			// Open modal
			await user.click(screen.getByRole("button", { name: "Create Deck" }));

			// Fill in form
			await user.type(screen.getByLabelText("Name"), "New Deck");
			await user.type(
				screen.getByLabelText("Description (optional)"),
				"A new deck",
			);

			// Submit
			await user.click(screen.getByRole("button", { name: "Create" }));

			// Modal should close
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).toBeNull();
			});

			// Deck list should be refreshed with new deck
			await waitFor(() => {
				expect(screen.getByRole("heading", { name: "New Deck" })).toBeDefined();
			});
			expect(screen.getByText("A new deck")).toBeDefined();

			// API should have been called twice (initial + refresh)
			expect(apiClient.rpc.api.decks.$get).toHaveBeenCalledTimes(2);
		});
	});

	describe("Edit Deck", () => {
		it("shows Edit button for each deck", async () => {
			vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
				mockResponse({
					ok: true,
					json: async () => ({ decks: mockDecks }),
				}),
			);

			renderWithProviders();

			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: "Japanese Vocabulary" }),
				).toBeDefined();
			});

			const editButtons = screen.getAllByRole("button", { name: "Edit" });
			expect(editButtons.length).toBe(2);
		});

		it("opens edit modal when Edit button is clicked", async () => {
			const user = userEvent.setup();
			vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
				mockResponse({
					ok: true,
					json: async () => ({ decks: mockDecks }),
				}),
			);

			renderWithProviders();

			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: "Japanese Vocabulary" }),
				).toBeDefined();
			});

			const editButtons = screen.getAllByRole("button", { name: "Edit" });
			await user.click(editButtons.at(0) as HTMLElement);

			expect(screen.getByRole("dialog")).toBeDefined();
			expect(screen.getByRole("heading", { name: "Edit Deck" })).toBeDefined();
			expect(screen.getByLabelText("Name")).toHaveProperty(
				"value",
				"Japanese Vocabulary",
			);
		});

		it("closes edit modal when Cancel is clicked", async () => {
			const user = userEvent.setup();
			vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
				mockResponse({
					ok: true,
					json: async () => ({ decks: mockDecks }),
				}),
			);

			renderWithProviders();

			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: "Japanese Vocabulary" }),
				).toBeDefined();
			});

			const editButtons = screen.getAllByRole("button", { name: "Edit" });
			await user.click(editButtons.at(0) as HTMLElement);

			expect(screen.getByRole("dialog")).toBeDefined();

			await user.click(screen.getByRole("button", { name: "Cancel" }));

			expect(screen.queryByRole("dialog")).toBeNull();
		});

		it("edits deck and refreshes list", async () => {
			const user = userEvent.setup();
			const updatedDeck = {
				...mockDecks[0],
				name: "Updated Japanese",
			};

			vi.mocked(apiClient.rpc.api.decks.$get)
				.mockResolvedValueOnce(
					mockResponse({
						ok: true,
						json: async () => ({ decks: mockDecks }),
					}),
				)
				.mockResolvedValueOnce(
					mockResponse({
						ok: true,
						json: async () => ({ decks: [updatedDeck, mockDecks[1]] }),
					}),
				);

			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ deck: updatedDeck }),
			});

			renderWithProviders();

			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: "Japanese Vocabulary" }),
				).toBeDefined();
			});

			// Click Edit on first deck
			const editButtons = screen.getAllByRole("button", { name: "Edit" });
			await user.click(editButtons.at(0) as HTMLElement);

			// Update name
			const nameInput = screen.getByLabelText("Name");
			await user.clear(nameInput);
			await user.type(nameInput, "Updated Japanese");

			// Save
			await user.click(screen.getByRole("button", { name: "Save" }));

			// Modal should close
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).toBeNull();
			});

			// Deck list should be refreshed with updated name
			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: "Updated Japanese" }),
				).toBeDefined();
			});

			// API should have been called twice (initial + refresh)
			expect(apiClient.rpc.api.decks.$get).toHaveBeenCalledTimes(2);
		});
	});

	describe("Delete Deck", () => {
		it("shows Delete button for each deck", async () => {
			vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
				mockResponse({
					ok: true,
					json: async () => ({ decks: mockDecks }),
				}),
			);

			renderWithProviders();

			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: "Japanese Vocabulary" }),
				).toBeDefined();
			});

			const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
			expect(deleteButtons.length).toBe(2);
		});

		it("opens delete modal when Delete button is clicked", async () => {
			const user = userEvent.setup();
			vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
				mockResponse({
					ok: true,
					json: async () => ({ decks: mockDecks }),
				}),
			);

			renderWithProviders();

			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: "Japanese Vocabulary" }),
				).toBeDefined();
			});

			const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
			await user.click(deleteButtons.at(0) as HTMLElement);

			expect(screen.getByRole("dialog")).toBeDefined();
			expect(
				screen.getByRole("heading", { name: "Delete Deck" }),
			).toBeDefined();
			// The deck name appears in both the list and the modal, so check specifically within the dialog
			const dialog = screen.getByRole("dialog");
			expect(dialog.textContent).toContain("Japanese Vocabulary");
		});

		it("closes delete modal when Cancel is clicked", async () => {
			const user = userEvent.setup();
			vi.mocked(apiClient.rpc.api.decks.$get).mockResolvedValue(
				mockResponse({
					ok: true,
					json: async () => ({ decks: mockDecks }),
				}),
			);

			renderWithProviders();

			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: "Japanese Vocabulary" }),
				).toBeDefined();
			});

			const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
			await user.click(deleteButtons.at(0) as HTMLElement);

			expect(screen.getByRole("dialog")).toBeDefined();

			await user.click(screen.getByRole("button", { name: "Cancel" }));

			expect(screen.queryByRole("dialog")).toBeNull();
		});

		it("deletes deck and refreshes list", async () => {
			const user = userEvent.setup();

			vi.mocked(apiClient.rpc.api.decks.$get)
				.mockResolvedValueOnce(
					mockResponse({
						ok: true,
						json: async () => ({ decks: mockDecks }),
					}),
				)
				.mockResolvedValueOnce(
					mockResponse({
						ok: true,
						json: async () => ({ decks: [mockDecks[1]] }),
					}),
				);

			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({}),
			});

			renderWithProviders();

			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: "Japanese Vocabulary" }),
				).toBeDefined();
			});

			// Click Delete on first deck
			const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
			await user.click(deleteButtons.at(0) as HTMLElement);

			// Wait for modal to appear
			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeDefined();
			});

			// Confirm deletion - get the Delete button inside the dialog
			const dialog = screen.getByRole("dialog");
			const dialogButtons = dialog.querySelectorAll("button");
			const deleteButton = Array.from(dialogButtons).find(
				(btn) => btn.textContent === "Delete",
			);
			await user.click(deleteButton as HTMLElement);

			// Modal should close
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).toBeNull();
			});

			// Deck list should be refreshed without deleted deck
			await waitFor(() => {
				expect(
					screen.queryByRole("heading", { name: "Japanese Vocabulary" }),
				).toBeNull();
			});
			expect(
				screen.getByRole("heading", { name: "Spanish Verbs" }),
			).toBeDefined();

			// API should have been called twice (initial + refresh)
			expect(apiClient.rpc.api.decks.$get).toHaveBeenCalledTimes(2);
		});
	});
});
