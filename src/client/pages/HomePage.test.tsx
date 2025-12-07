/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { apiClient } from "../api/client";
import { AuthProvider } from "../stores";
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

// Helper to create mock responses compatible with Hono's ClientResponse
// biome-ignore lint/suspicious/noExplicitAny: Test helper needs flexible typing
function mockResponse(data: { ok: boolean; status?: number; json: () => Promise<any> }) {
	return data as unknown as Awaited<ReturnType<typeof apiClient.rpc.api.decks.$get>>;
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
				<HomePage />
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
});
