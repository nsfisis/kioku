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
import { NoteTypesPage } from "./NoteTypesPage";

vi.mock("../api/client", () => ({
	apiClient: {
		login: vi.fn(),
		logout: vi.fn(),
		isAuthenticated: vi.fn(),
		getTokens: vi.fn(),
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

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

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

function renderWithProviders(path = "/note-types") {
	const { hook } = memoryLocation({ path });
	return render(
		<Router hook={hook}>
			<AuthProvider>
				<SyncProvider>
					<NoteTypesPage />
				</SyncProvider>
			</AuthProvider>
		</Router>,
	);
}

describe("NoteTypesPage", () => {
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

	it("renders page title and back button", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ noteTypes: [] }),
		});

		renderWithProviders();

		expect(
			screen.getByRole("heading", { name: "Note Types" }),
		).toBeDefined();
		expect(screen.getByRole("link", { name: "Back to Home" })).toBeDefined();
	});

	it("shows loading state while fetching note types", async () => {
		mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

		renderWithProviders();

		// Loading state shows spinner (svg with animate-spin class)
		expect(document.querySelector(".animate-spin")).toBeDefined();
	});

	it("displays empty state when no note types exist", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ noteTypes: [] }),
		});

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByText("No note types yet")).toBeDefined();
		});
		expect(
			screen.getByText(
				"Create a note type to define how your cards are structured",
			),
		).toBeDefined();
	});

	it("displays list of note types", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ noteTypes: mockNoteTypes }),
		});

		renderWithProviders();

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "Basic" }),
			).toBeDefined();
		});
		expect(
			screen.getByRole("heading", { name: "Basic (and reversed card)" }),
		).toBeDefined();
	});

	it("displays reversible badge for reversible note types", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ noteTypes: mockNoteTypes }),
		});

		renderWithProviders();

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "Basic (and reversed card)" }),
			).toBeDefined();
		});

		expect(screen.getByText("Reversible")).toBeDefined();
	});

	it("displays template info for each note type", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ noteTypes: mockNoteTypes }),
		});

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByRole("heading", { name: "Basic" })).toBeDefined();
		});

		expect(screen.getAllByText("Front: {{Front}}").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Back: {{Back}}").length).toBeGreaterThan(0);
	});

	it("displays error on API failure", async () => {
		mockFetch.mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({ error: "Internal server error" }),
		});

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Internal server error",
			);
		});
	});

	it("displays generic error on unexpected failure", async () => {
		mockFetch.mockRejectedValue(new Error("Network error"));

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to load note types. Please try again.",
			);
		});
	});

	it("allows retry after error", async () => {
		const user = userEvent.setup();
		mockFetch
			.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: async () => ({ error: "Server error" }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			});

		renderWithProviders();

		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeDefined();
		});

		await user.click(screen.getByRole("button", { name: "Retry" }));

		await waitFor(() => {
			expect(screen.getByRole("heading", { name: "Basic" })).toBeDefined();
		});
	});

	it("passes auth header when fetching note types", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ noteTypes: [] }),
		});

		renderWithProviders();

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledWith("/api/note-types", {
				headers: { Authorization: "Bearer access-token" },
			});
		});
	});

	describe("Create Note Type", () => {
		it("shows New Note Type button", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ noteTypes: [] }),
			});

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByText("No note types yet")).toBeDefined();
			});

			expect(
				screen.getByRole("button", { name: /New Note Type/i }),
			).toBeDefined();
		});

		it("opens modal when New Note Type button is clicked", async () => {
			const user = userEvent.setup();
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ noteTypes: [] }),
			});

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByText("No note types yet")).toBeDefined();
			});

			await user.click(
				screen.getByRole("button", { name: /New Note Type/i }),
			);

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

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ noteTypes: [] }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ noteType: newNoteType }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ noteTypes: [newNoteType] }),
				});

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByText("No note types yet")).toBeDefined();
			});

			// Open modal
			await user.click(
				screen.getByRole("button", { name: /New Note Type/i }),
			);

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
		it("shows Edit button for each note type", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			});

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByRole("heading", { name: "Basic" })).toBeDefined();
			});

			const editButtons = screen.getAllByRole("button", {
				name: "Edit note type",
			});
			expect(editButtons.length).toBe(2);
		});

		it("opens edit modal when Edit button is clicked", async () => {
			const user = userEvent.setup();
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			});

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByRole("heading", { name: "Basic" })).toBeDefined();
			});

			const editButtons = screen.getAllByRole("button", {
				name: "Edit note type",
			});
			await user.click(editButtons.at(0) as HTMLElement);

			expect(screen.getByRole("dialog")).toBeDefined();
			expect(
				screen.getByRole("heading", { name: "Edit Note Type" }),
			).toBeDefined();
			expect(screen.getByLabelText("Name")).toHaveProperty("value", "Basic");
		});

		it("edits note type and refreshes list", async () => {
			const user = userEvent.setup();
			const updatedNoteType = {
				...mockNoteTypes[0],
				name: "Updated Basic",
			};

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ noteTypes: mockNoteTypes }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ noteType: updatedNoteType }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ noteTypes: [updatedNoteType, mockNoteTypes[1]] }),
				});

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByRole("heading", { name: "Basic" })).toBeDefined();
			});

			// Click Edit on first note type
			const editButtons = screen.getAllByRole("button", {
				name: "Edit note type",
			});
			await user.click(editButtons.at(0) as HTMLElement);

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
		it("shows Delete button for each note type", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			});

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByRole("heading", { name: "Basic" })).toBeDefined();
			});

			const deleteButtons = screen.getAllByRole("button", {
				name: "Delete note type",
			});
			expect(deleteButtons.length).toBe(2);
		});

		it("opens delete modal when Delete button is clicked", async () => {
			const user = userEvent.setup();
			mockFetch.mockResolvedValue({
				ok: true,
				json: async () => ({ noteTypes: mockNoteTypes }),
			});

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByRole("heading", { name: "Basic" })).toBeDefined();
			});

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

			mockFetch
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ noteTypes: mockNoteTypes }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ success: true }),
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ noteTypes: [mockNoteTypes[1]] }),
				});

			renderWithProviders();

			await waitFor(() => {
				expect(screen.getByRole("heading", { name: "Basic" })).toBeDefined();
			});

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
				expect(
					screen.queryByRole("heading", { name: "Basic" }),
				).toBeNull();
			});
			expect(
				screen.getByRole("heading", { name: "Basic (and reversed card)" }),
			).toBeDefined();
		});
	});
});
