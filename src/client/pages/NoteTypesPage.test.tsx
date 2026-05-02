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
import { authLoadingAtom, type NoteType, userAtom } from "../atoms";
import { db } from "../db";
import { NoteTypesPage } from "./NoteTypesPage";

interface RenderOptions {
	path?: string;
	initialNoteTypes?: NoteType[];
}

vi.mock("../api/client", () => ({
	apiClient: {
		login: vi.fn(),
		logout: vi.fn(),
		getTokens: vi.fn(),
		getAuthHeader: vi.fn(),
		onSessionExpired: vi.fn(() => vi.fn()),
		rpc: { api: { "note-types": {} } },
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
vi.mock("../queryClient", () => ({
	get queryClient() {
		return testQueryClient;
	},
}));

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

async function seedNoteTypesInLocalDb(
	noteTypes: NoteType[],
	userId: string,
	fields: {
		noteTypeId: string;
		id: string;
		name: string;
		order: number;
	}[] = [],
) {
	for (const nt of noteTypes) {
		await db.noteTypes.put({
			id: nt.id,
			userId,
			name: nt.name,
			frontTemplate: nt.frontTemplate,
			backTemplate: nt.backTemplate,
			isReversible: nt.isReversible,
			createdAt: new Date(nt.createdAt),
			updatedAt: new Date(nt.updatedAt),
			deletedAt: null,
			syncVersion: 0,
			_synced: true,
		});
	}
	for (const f of fields) {
		await db.noteFieldTypes.put({
			id: f.id,
			noteTypeId: f.noteTypeId,
			name: f.name,
			order: f.order,
			fieldType: "text",
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null,
			syncVersion: 0,
			_synced: true,
		});
	}
}

function renderWithProviders({
	path = "/note-types",
	initialNoteTypes,
}: RenderOptions = {}) {
	const { hook } = memoryLocation({ path });
	const store = createStore();
	store.set(authLoadingAtom, false);
	store.set(userAtom, { id: "user-1", username: "alice" });
	store.set(queryClientAtom, testQueryClient);

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
	beforeEach(async () => {
		vi.clearAllMocks();
		if (!db.isOpen()) {
			await db.open();
		}
		await db.noteTypes.clear();
		await db.noteFieldTypes.clear();
		await db.notes.clear();
		await db.noteFieldValues.clear();

		testQueryClient = new QueryClient({
			defaultOptions: {
				queries: { staleTime: Number.POSITIVE_INFINITY, retry: false },
			},
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

		it("creates a note type locally and closes the modal", async () => {
			const user = userEvent.setup();

			renderWithProviders({ initialNoteTypes: [] });

			await user.click(screen.getByRole("button", { name: /New Note Type/i }));
			await user.type(screen.getByLabelText("Name"), "New Note Type");
			await user.click(screen.getByRole("button", { name: "Create" }));

			await waitFor(() => {
				expect(screen.queryByRole("dialog")).toBeNull();
			});

			const persisted = await db.noteTypes
				.filter((nt) => nt.name === "New Note Type")
				.first();
			expect(persisted).toBeDefined();
			expect(persisted?._synced).toBe(false);
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

		it("opens edit modal and loads the note type from local DB", async () => {
			const user = userEvent.setup();

			await seedNoteTypesInLocalDb(mockNoteTypes, "user-1", [
				{
					id: "field-1",
					noteTypeId: "note-type-1",
					name: "Front",
					order: 0,
				},
				{ id: "field-2", noteTypeId: "note-type-1", name: "Back", order: 1 },
			]);
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

		it("updates the note type locally and closes the editor", async () => {
			const user = userEvent.setup();

			await seedNoteTypesInLocalDb(mockNoteTypes, "user-1");
			renderWithProviders({ initialNoteTypes: mockNoteTypes });

			const editButtons = screen.getAllByRole("button", {
				name: "Edit note type",
			});
			await user.click(editButtons.at(0) as HTMLElement);

			await waitFor(() => {
				expect(screen.getByLabelText("Name")).toHaveProperty("value", "Basic");
			});

			const nameInput = screen.getByLabelText("Name");
			await user.clear(nameInput);
			await user.type(nameInput, "Updated Basic");

			await user.click(screen.getByRole("button", { name: "Save Changes" }));

			await waitFor(() => {
				expect(screen.queryByRole("dialog")).toBeNull();
			});

			const persisted = await db.noteTypes.get("note-type-1");
			expect(persisted?.name).toBe("Updated Basic");
			expect(persisted?._synced).toBe(false);
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

		it("soft-deletes the note type locally and closes the modal", async () => {
			const user = userEvent.setup();

			await seedNoteTypesInLocalDb(mockNoteTypes, "user-1");
			renderWithProviders({ initialNoteTypes: mockNoteTypes });

			const deleteButtons = screen.getAllByRole("button", {
				name: "Delete note type",
			});
			await user.click(deleteButtons.at(0) as HTMLElement);

			await waitFor(() => {
				expect(screen.getByRole("dialog")).toBeDefined();
			});

			const dialog = screen.getByRole("dialog");
			const dialogButtons = dialog.querySelectorAll("button");
			const deleteButton = Array.from(dialogButtons).find(
				(btn) => btn.textContent === "Delete",
			);
			await user.click(deleteButton as HTMLElement);

			await waitFor(() => {
				expect(screen.queryByRole("dialog")).toBeNull();
			});

			const persisted = await db.noteTypes.get("note-type-1");
			expect(persisted?.deletedAt).not.toBeNull();
			expect(persisted?._synced).toBe(false);
		});
	});
});
