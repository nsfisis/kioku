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
		rpc: {
			api: {
				decks: {
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

// Import after mock is set up
import { CreateDeckModal } from "./CreateDeckModal";

// Helper to create mock responses
function mockResponse(data: {
	ok: boolean;
	status?: number;
	// biome-ignore lint/suspicious/noExplicitAny: Test helper needs flexible typing
	json: () => Promise<any>;
}) {
	return data as unknown as Awaited<
		ReturnType<typeof apiClient.rpc.api.decks.$post>
	>;
}

describe("CreateDeckModal", () => {
	const defaultProps = {
		isOpen: true,
		onClose: vi.fn(),
		onDeckCreated: vi.fn(),
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
		render(<CreateDeckModal {...defaultProps} isOpen={false} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders modal when open", () => {
		render(<CreateDeckModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(
			screen.getByRole("heading", { name: "Create New Deck" }),
		).toBeDefined();
		expect(screen.getByLabelText("Name")).toBeDefined();
		expect(screen.getByLabelText("Description (optional)")).toBeDefined();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Create" })).toBeDefined();
	});

	it("disables create button when name is empty", () => {
		render(<CreateDeckModal {...defaultProps} />);

		const createButton = screen.getByRole("button", { name: "Create" });
		expect(createButton).toHaveProperty("disabled", true);
	});

	it("enables create button when name has content", async () => {
		const user = userEvent.setup();
		render(<CreateDeckModal {...defaultProps} />);

		const nameInput = screen.getByLabelText("Name");
		await user.type(nameInput, "My Deck");

		const createButton = screen.getByRole("button", { name: "Create" });
		expect(createButton).toHaveProperty("disabled", false);
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<CreateDeckModal {...defaultProps} onClose={onClose} />);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("calls onClose when clicking outside the modal", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<CreateDeckModal {...defaultProps} onClose={onClose} />);

		// Click on the backdrop (the dialog element itself)
		const dialog = screen.getByRole("dialog");
		await user.click(dialog);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("does not call onClose when clicking inside the modal content", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<CreateDeckModal {...defaultProps} onClose={onClose} />);

		// Click on an element inside the modal
		await user.click(screen.getByLabelText("Name"));

		expect(onClose).not.toHaveBeenCalled();
	});

	it("creates deck with name only", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onDeckCreated = vi.fn();

		vi.mocked(apiClient.rpc.api.decks.$post).mockResolvedValue(
			mockResponse({
				ok: true,
				json: async () => ({
					deck: {
						id: "deck-1",
						name: "Test Deck",
						description: null,
						newCardsPerDay: 20,
					},
				}),
			}),
		);

		render(
			<CreateDeckModal
				isOpen={true}
				onClose={onClose}
				onDeckCreated={onDeckCreated}
			/>,
		);

		await user.type(screen.getByLabelText("Name"), "Test Deck");
		await user.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(apiClient.rpc.api.decks.$post).toHaveBeenCalledWith(
				{ json: { name: "Test Deck", description: null } },
				{ headers: { Authorization: "Bearer access-token" } },
			);
		});

		expect(onDeckCreated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("creates deck with name and description", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onDeckCreated = vi.fn();

		vi.mocked(apiClient.rpc.api.decks.$post).mockResolvedValue(
			mockResponse({
				ok: true,
				json: async () => ({
					deck: {
						id: "deck-1",
						name: "Test Deck",
						description: "A test description",
						newCardsPerDay: 20,
					},
				}),
			}),
		);

		render(
			<CreateDeckModal
				isOpen={true}
				onClose={onClose}
				onDeckCreated={onDeckCreated}
			/>,
		);

		await user.type(screen.getByLabelText("Name"), "Test Deck");
		await user.type(
			screen.getByLabelText("Description (optional)"),
			"A test description",
		);
		await user.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(apiClient.rpc.api.decks.$post).toHaveBeenCalledWith(
				{ json: { name: "Test Deck", description: "A test description" } },
				{ headers: { Authorization: "Bearer access-token" } },
			);
		});

		expect(onDeckCreated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("trims whitespace from name and description", async () => {
		const user = userEvent.setup();

		vi.mocked(apiClient.rpc.api.decks.$post).mockResolvedValue(
			mockResponse({
				ok: true,
				json: async () => ({ deck: { id: "deck-1" } }),
			}),
		);

		render(<CreateDeckModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "  Test Deck  ");
		await user.type(
			screen.getByLabelText("Description (optional)"),
			"  Description  ",
		);
		await user.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(apiClient.rpc.api.decks.$post).toHaveBeenCalledWith(
				{ json: { name: "Test Deck", description: "Description" } },
				{ headers: { Authorization: "Bearer access-token" } },
			);
		});
	});

	it("shows loading state during submission", async () => {
		const user = userEvent.setup();

		vi.mocked(apiClient.rpc.api.decks.$post).mockImplementation(
			() => new Promise(() => {}), // Never resolves
		);

		render(<CreateDeckModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "Test Deck");
		await user.click(screen.getByRole("button", { name: "Create" }));

		expect(screen.getByRole("button", { name: "Creating..." })).toBeDefined();
		expect(screen.getByRole("button", { name: "Creating..." })).toHaveProperty(
			"disabled",
			true,
		);
		expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty(
			"disabled",
			true,
		);
		expect(screen.getByLabelText("Name")).toHaveProperty("disabled", true);
		expect(screen.getByLabelText("Description (optional)")).toHaveProperty(
			"disabled",
			true,
		);
	});

	it("displays API error message", async () => {
		const user = userEvent.setup();

		vi.mocked(apiClient.rpc.api.decks.$post).mockResolvedValue(
			mockResponse({
				ok: false,
				status: 400,
				json: async () => ({ error: "Deck name already exists" }),
			}),
		);

		render(<CreateDeckModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "Test Deck");
		await user.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Deck name already exists",
			);
		});
	});

	it("displays generic error on unexpected failure", async () => {
		const user = userEvent.setup();

		vi.mocked(apiClient.rpc.api.decks.$post).mockRejectedValue(
			new Error("Network error"),
		);

		render(<CreateDeckModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "Test Deck");
		await user.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to create deck. Please try again.",
			);
		});
	});

	it("resets form when closed and reopened", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		const { rerender } = render(
			<CreateDeckModal
				isOpen={true}
				onClose={onClose}
				onDeckCreated={vi.fn()}
			/>,
		);

		// Type something in the form
		await user.type(screen.getByLabelText("Name"), "Test Deck");
		await user.type(
			screen.getByLabelText("Description (optional)"),
			"Test Description",
		);

		// Click cancel to close
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		// Reopen the modal
		rerender(
			<CreateDeckModal
				isOpen={true}
				onClose={onClose}
				onDeckCreated={vi.fn()}
			/>,
		);

		// Form should be reset
		expect(screen.getByLabelText("Name")).toHaveProperty("value", "");
		expect(screen.getByLabelText("Description (optional)")).toHaveProperty(
			"value",
			"",
		);
	});

	it("resets form after successful creation", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		vi.mocked(apiClient.rpc.api.decks.$post).mockResolvedValue(
			mockResponse({
				ok: true,
				json: async () => ({ deck: { id: "deck-1" } }),
			}),
		);

		const { rerender } = render(
			<CreateDeckModal
				isOpen={true}
				onClose={onClose}
				onDeckCreated={vi.fn()}
			/>,
		);

		// Create a deck
		await user.type(screen.getByLabelText("Name"), "Test Deck");
		await user.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(onClose).toHaveBeenCalled();
		});

		// Reopen the modal
		rerender(
			<CreateDeckModal
				isOpen={true}
				onClose={onClose}
				onDeckCreated={vi.fn()}
			/>,
		);

		// Form should be reset
		expect(screen.getByLabelText("Name")).toHaveProperty("value", "");
		expect(screen.getByLabelText("Description (optional)")).toHaveProperty(
			"value",
			"",
		);
	});
});
