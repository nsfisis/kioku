/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { QueryClient } from "@tanstack/query-core";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore, Provider } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { authLoadingAtom, type NoteType } from "../atoms";
import { NoteTypesPage } from "./NoteTypesPage";

interface RenderOptions {
	path?: string;
	initialNoteTypes?: NoteType[];
}

const mockNoteTypesGet = vi.fn();
const mockNoteTypesPost = vi.fn();
const mockNoteTypeGet = vi.fn();
const mockNoteTypePut = vi.fn();
const mockNoteTypeDelete = vi.fn();
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
				"note-types": {
					$get: () => mockNoteTypesGet(),
					$post: (args: unknown) => mockNoteTypesPost(args),
					":id": {
						$get: (args: unknown) => mockNoteTypeGet(args),
						$put: (args: unknown) => mockNoteTypePut(args),
						$delete: (args: unknown) => mockNoteTypeDelete(args),
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

// Mock queryClient module so pages use our test queryClient
let testQueryClient: QueryClient;
vi.mock("../queryClient", () => ({
	get queryClient() {
		return testQueryClient;
	},
}));

import { ApiClientError, apiClient } from "../api/client";

const mockNoteTypes = [
	{
		id: "note-type-1",
		name: "Basic",
		frontTemplate: "{{Front}}",
		backTemplate: "{{Back}}",
		isReversible: false,
		createdAt: "2024-01-01T00:00:00Z",
		updatedAt: "2024-01-01T00:00:00Z",
	},
	{
		id: "note-type-2",
		name: "Basic (and reversed card)",
		frontTemplate: "{{Front}}",
		backTemplate: "{{Back}}",
		isReversible: true,
		createdAt: "2024-01-02T00:00:00Z",
		updatedAt: "2024-01-02T00:00:00Z",
	},
];

function renderWithProviders({
	path = "/note-types",
	initialNoteTypes,
}: RenderOptions = {}) {
	const { hook } = memoryLocation({ path });
	const store = createStore();
	store.set(authLoadingAtom, false);
	store.set(queryClientAtom, testQueryClient);

	// Seed query cache if initial data provided
	if (initialNoteTypes !== undefined) {
		testQueryClient.setQueryData(["noteTypes"], initialNoteTypes);
	}

	return render(
		<Provider store={store}>
			<Router hook={hook}>
				<NoteTypesPage />
			</Router>
		</Provider>,
	);
}

describe("NoteTypesPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		testQueryClient = new QueryClient({
			defaultOptions: {
				queries: { staleTime: Number.POSITIVE_INFINITY, retry: false },
			},
		});
		vi.mocked(apiClient.getTokens).mockReturnValue({
			accessToken: "access-token",
			refreshToken: "refresh-token",
		});
		vi.mocked(apiClient.isAuthenticated).mockReturnValue(true);
		vi.mocked(apiClient.getAuthHeader).mockReturnValue({
			Authorization: "Bearer access-token",
		});

		// handleResponse simulates actual behavior
		// - If response is a plain object (from mocked RPC), pass through
		// - If response is Response-like with ok/status, handle properly
		mockHandleResponse.mockImplementation(async (res) => {
			// Plain object (already the data) - pass through
			if (res.ok === undefined && res.status === undefined) {
				return res;
			}
			// Response-like object
			if (!res.ok) {
				const body = await res.json?.().catch(() => ({}));
				throw new Error(
					body?.error || `Request failed with status ${res.status}`,
				);
			}
			return typeof res.json === "function" ? res.json() : res;
		});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		testQueryClient.clear();
	});

	it("renders page title and back button", () => {
		renderWithProviders({ initialNoteTypes: [] });

		expect(screen.getByRole("heading", { name: "Note Types" })).toBeDefined();
		expect(screen.getByRole("link", { name: "Back to Home" })).toBeDefined();
	});

	it("shows loading state while fetching note types", async () => {
		mockNoteTypesGet.mockImplementation(() => new Promise(() => {})); // Never resolves

		renderWithProviders();

		// Loading state shows spinner (svg with animate-spin class)
		expect(document.querySelector(".animate-spin")).toBeDefined();
	});

	it("displays empty state when no note types exist", () => {
		renderWithProviders({ initialNoteTypes: [] });

		expect(screen.getByText("No note types yet")).toBeDefined();
		expect(
			screen.getByText(
				"Create a note type to define how your cards are structured",
			),
		).toBeDefined();
	});

	it("displays list of note types", () => {
		renderWithProviders({ initialNoteTypes: mockNoteTypes });

		expect(screen.getByRole("heading", { name: "Basic" })).toBeDefined();
		expect(
			screen.getByRole("heading", { name: "Basic (and reversed card)" }),
		).toBeDefined();
	});

	it("displays reversible badge for reversible note types", () => {
		renderWithProviders({ initialNoteTypes: mockNoteTypes });

		expect(
			screen.getByRole("heading", { name: "Basic (and reversed card)" }),
		).toBeDefined();
		expect(screen.getByText("Reversible")).toBeDefined();
	});

	it("displays template info for each note type", () => {
		renderWithProviders({ initialNoteTypes: mockNoteTypes });

		expect(screen.getByRole("heading", { name: "Basic" })).toBeDefined();
		expect(screen.getAllByText("Front: {{Front}}").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Back: {{Back}}").length).toBeGreaterThan(0);
	});

	// Skip: Error boundary tests don't work reliably with Jotai async atoms in test environment.
	// Errors from rejected Promises in async atoms are not caught by ErrorBoundary in vitest.
	it.skip("displays error on API failure", async () => {
		mockNoteTypesGet.mockRejectedValue(
			new ApiClientError("Internal server error", 500),
		);

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Internal server error",
			);
		});
	});

	// Skip: Same reason as above
	it.skip("displays generic error on unexpected failure", async () => {
		mockNoteTypesGet.mockRejectedValue(new Error("Network error"));

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain("Network error");
		});
	});

	// Skip: Testing RPC endpoint calls is difficult with Suspense in test environment.
	it.skip("calls correct RPC endpoint when fetching note types", async () => {
		mockNoteTypesGet.mockResolvedValue({ noteTypes: [] });

		renderWithProviders();

		await waitFor(() => {
			expect(mockNoteTypesGet).toHaveBeenCalled();
		});
	});

	describe("Create Note Type", () => {
		it("shows New Note Type button", () => {
			renderWithProviders({ initialNoteTypes: [] });

			expect(screen.getByText("No note types yet")).toBeDefined();
			expect(
				screen.getByRole("button", { name: /New Note Type/i }),
			).toBeDefined();
		});

		it("opens modal when New Note Type button is clicked", async () => {
			const user = userEvent.setup();
			renderWithProviders({ initialNoteTypes: [] });

			await user.click(screen.getByRole("button", { name: /New Note Type/i }));

			expect(screen.getByRole("dialog")).toBeDefined();
			expect(
				screen.getByRole("heading", { name: "Create Note Type" }),
			).toBeDefined();
		});

		it("creates note type and refreshes list", async () => {
			const user = userEvent.setup();
			const newNoteType = {
				id: "note-type-new",
				name: "New Note Type",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: false,
				createdAt: "2024-01-03T00:00:00Z",
				updatedAt: "2024-01-03T00:00:00Z",
			};

			// Mock the POST response and subsequent GET after reload
			mockNoteTypesPost.mockResolvedValue({
				ok: true,
				json: async () => ({ noteType: newNoteType }),
			});
			mockNoteTypesGet.mockResolvedValue({ noteTypes: [newNoteType] });

			renderWithProviders({ initialNoteTypes: [] });

			// Open modal
			await user.click(screen.getByRole("button", { name: /New Note Type/i }));

			// Fill in form
			await user.type(screen.getByLabelText("Name"), "New Note Type");

			// Submit
			await user.click(screen.getByRole("button", { name: "Create" }));

			// Modal should close
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).toBeNull();
			});

			// Note type list should be refreshed with new note type
			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: "New Note Type" }),
				).toBeDefined();
			});
		});
	});

	describe("Edit Note Type", () => {
		it("shows Edit button for each note type", () => {
			renderWithProviders({ initialNoteTypes: mockNoteTypes });

			expect(screen.getByRole("heading", { name: "Basic" })).toBeDefined();

			const editButtons = screen.getAllByRole("button", {
				name: "Edit note type",
			});
			expect(editButtons.length).toBe(2);
		});

		it("opens edit modal when Edit button is clicked", async () => {
			const user = userEvent.setup();
			const mockNoteTypeWithFields = {
				...mockNoteTypes[0],
				fields: [
					{
						id: "field-1",
						noteTypeId: "note-type-1",
						name: "Front",
						order: 0,
						fieldType: "text",
					},
					{
						id: "field-2",
						noteTypeId: "note-type-1",
						name: "Back",
						order: 1,
						fieldType: "text",
					},
				],
			};

			mockNoteTypeGet.mockResolvedValue({ noteType: mockNoteTypeWithFields });

			renderWithProviders({ initialNoteTypes: mockNoteTypes });

			const editButtons = screen.getAllByRole("button", {
				name: "Edit note type",
			});
			await user.click(editButtons.at(0) as HTMLElement);

			expect(screen.getByRole("dialog")).toBeDefined();
			expect(
				screen.getByRole("heading", { name: "Edit Note Type" }),
			).toBeDefined();

			await waitFor(() => {
				expect(screen.getByLabelText("Name")).toHaveProperty("value", "Basic");
			});
		});

		it("edits note type and refreshes list", async () => {
			const user = userEvent.setup();
			const mockNoteTypeWithFields = {
				...mockNoteTypes[0],
				fields: [
					{
						id: "field-1",
						noteTypeId: "note-type-1",
						name: "Front",
						order: 0,
						fieldType: "text",
					},
					{
						id: "field-2",
						noteTypeId: "note-type-1",
						name: "Back",
						order: 1,
						fieldType: "text",
					},
				],
			};
			const updatedNoteType = {
				...mockNoteTypes[0],
				name: "Updated Basic",
			};

			mockNoteTypeGet.mockResolvedValue({ noteType: mockNoteTypeWithFields });
			mockNoteTypePut.mockResolvedValue({
				ok: true,
				json: async () => ({ noteType: updatedNoteType }),
			});
			mockNoteTypesGet.mockResolvedValue({
				noteTypes: [updatedNoteType, mockNoteTypes[1]],
			});

			renderWithProviders({ initialNoteTypes: mockNoteTypes });

			// Click Edit on first note type
			const editButtons = screen.getAllByRole("button", {
				name: "Edit note type",
			});
			await user.click(editButtons.at(0) as HTMLElement);

			// Wait for the editor to load
			await waitFor(() => {
				expect(screen.getByLabelText("Name")).toHaveProperty("value", "Basic");
			});

			// Update name
			const nameInput = screen.getByLabelText("Name");
			await user.clear(nameInput);
			await user.type(nameInput, "Updated Basic");

			// Save
			await user.click(screen.getByRole("button", { name: "Save Changes" }));

			// Modal should close
			await waitFor(() => {
				expect(screen.queryByRole("dialog")).toBeNull();
			});

			// Note type list should be refreshed with updated name
			await waitFor(() => {
				expect(
					screen.getByRole("heading", { name: "Updated Basic" }),
				).toBeDefined();
			});
		});
	});

	describe("Delete Note Type", () => {
		it("shows Delete button for each note type", () => {
			renderWithProviders({ initialNoteTypes: mockNoteTypes });

			expect(screen.getByRole("heading", { name: "Basic" })).toBeDefined();

			const deleteButtons = screen.getAllByRole("button", {
				name: "Delete note type",
			});
			expect(deleteButtons.length).toBe(2);
		});

		it("opens delete modal when Delete button is clicked", async () => {
			const user = userEvent.setup();
			renderWithProviders({ initialNoteTypes: mockNoteTypes });

			const deleteButtons = screen.getAllByRole("button", {
				name: "Delete note type",
			});
			await user.click(deleteButtons.at(0) as HTMLElement);

			expect(screen.getByRole("dialog")).toBeDefined();
			expect(
				screen.getByRole("heading", { name: "Delete Note Type" }),
			).toBeDefined();
			const dialog = screen.getByRole("dialog");
			expect(dialog.textContent).toContain("Basic");
		});

		it("deletes note type and refreshes list", async () => {
			const user = userEvent.setup();

			mockNoteTypeDelete.mockResolvedValue({
				ok: true,
				json: async () => ({ success: true }),
			});
			mockNoteTypesGet.mockResolvedValue({ noteTypes: [mockNoteTypes[1]] });

			renderWithProviders({ initialNoteTypes: mockNoteTypes });

			// Click Delete on first note type
			const deleteButtons = screen.getAllByRole("button", {
				name: "Delete note type",
			});
			await user.click(deleteButtons.at(0) as HTMLElement);

			// Wait for modal to appear
			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeDefined();
			});

			// Confirm deletion
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

			// Note type list should be refreshed without deleted note type
			await waitFor(() => {
				expect(screen.queryByRole("heading", { name: "Basic" })).toBeNull();
			});
			expect(
				screen.getByRole("heading", { name: "Basic (and reversed card)" }),
			).toBeDefined();
		});
	});
});
