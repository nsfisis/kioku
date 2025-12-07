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
					":deckId": {
						cards: {
							$post: vi.fn(),
						},
					},
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
import { CreateCardModal } from "./CreateCardModal";

type CardPostFn = (typeof apiClient.rpc.api.decks)[":deckId"]["cards"]["$post"];

// Helper to create mock responses
function mockResponse(data: {
	ok: boolean;
	status?: number;
	// biome-ignore lint/suspicious/noExplicitAny: Test helper needs flexible typing
	json: () => Promise<any>;
}) {
	return data as unknown as Awaited<ReturnType<CardPostFn>>;
}

describe("CreateCardModal", () => {
	const defaultProps = {
		isOpen: true,
		deckId: "deck-123",
		onClose: vi.fn(),
		onCardCreated: vi.fn(),
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
		render(<CreateCardModal {...defaultProps} isOpen={false} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders modal when open", () => {
		render(<CreateCardModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(
			screen.getByRole("heading", { name: "Create New Card" }),
		).toBeDefined();
		expect(screen.getByLabelText("Front")).toBeDefined();
		expect(screen.getByLabelText("Back")).toBeDefined();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Create Card" })).toBeDefined();
	});

	it("disables create button when front is empty", async () => {
		const user = userEvent.setup();
		render(<CreateCardModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Back"), "Answer");

		const createButton = screen.getByRole("button", { name: "Create Card" });
		expect(createButton).toHaveProperty("disabled", true);
	});

	it("disables create button when back is empty", async () => {
		const user = userEvent.setup();
		render(<CreateCardModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Front"), "Question");

		const createButton = screen.getByRole("button", { name: "Create Card" });
		expect(createButton).toHaveProperty("disabled", true);
	});

	it("enables create button when both front and back have content", async () => {
		const user = userEvent.setup();
		render(<CreateCardModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Front"), "Question");
		await user.type(screen.getByLabelText("Back"), "Answer");

		const createButton = screen.getByRole("button", { name: "Create Card" });
		expect(createButton).toHaveProperty("disabled", false);
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<CreateCardModal {...defaultProps} onClose={onClose} />);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("calls onClose when clicking outside the modal", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<CreateCardModal {...defaultProps} onClose={onClose} />);

		// Click on the backdrop (the dialog element itself)
		const dialog = screen.getByRole("dialog");
		await user.click(dialog);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("does not call onClose when clicking inside the modal content", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<CreateCardModal {...defaultProps} onClose={onClose} />);

		// Click on an element inside the modal
		await user.click(screen.getByLabelText("Front"));

		expect(onClose).not.toHaveBeenCalled();
	});

	it("creates card with front and back", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onCardCreated = vi.fn();

		vi.mocked(apiClient.rpc.api.decks[":deckId"].cards.$post).mockResolvedValue(
			mockResponse({
				ok: true,
				json: async () => ({
					card: {
						id: "card-1",
						deckId: "deck-123",
						front: "What is 2+2?",
						back: "4",
					},
				}),
			}),
		);

		render(
			<CreateCardModal
				isOpen={true}
				deckId="deck-123"
				onClose={onClose}
				onCardCreated={onCardCreated}
			/>,
		);

		await user.type(screen.getByLabelText("Front"), "What is 2+2?");
		await user.type(screen.getByLabelText("Back"), "4");
		await user.click(screen.getByRole("button", { name: "Create Card" }));

		await waitFor(() => {
			expect(
				apiClient.rpc.api.decks[":deckId"].cards.$post,
			).toHaveBeenCalledWith(
				{
					param: { deckId: "deck-123" },
					json: { front: "What is 2+2?", back: "4" },
				},
				{ headers: { Authorization: "Bearer access-token" } },
			);
		});

		expect(onCardCreated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("trims whitespace from front and back", async () => {
		const user = userEvent.setup();

		vi.mocked(apiClient.rpc.api.decks[":deckId"].cards.$post).mockResolvedValue(
			mockResponse({
				ok: true,
				json: async () => ({ card: { id: "card-1" } }),
			}),
		);

		render(<CreateCardModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Front"), "  Question  ");
		await user.type(screen.getByLabelText("Back"), "  Answer  ");
		await user.click(screen.getByRole("button", { name: "Create Card" }));

		await waitFor(() => {
			expect(
				apiClient.rpc.api.decks[":deckId"].cards.$post,
			).toHaveBeenCalledWith(
				{
					param: { deckId: "deck-123" },
					json: { front: "Question", back: "Answer" },
				},
				{ headers: { Authorization: "Bearer access-token" } },
			);
		});
	});

	it("shows loading state during submission", async () => {
		const user = userEvent.setup();

		vi.mocked(
			apiClient.rpc.api.decks[":deckId"].cards.$post,
		).mockImplementation(
			() => new Promise(() => {}), // Never resolves
		);

		render(<CreateCardModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Front"), "Question");
		await user.type(screen.getByLabelText("Back"), "Answer");
		await user.click(screen.getByRole("button", { name: "Create Card" }));

		expect(screen.getByRole("button", { name: "Creating..." })).toBeDefined();
		expect(screen.getByRole("button", { name: "Creating..." })).toHaveProperty(
			"disabled",
			true,
		);
		expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty(
			"disabled",
			true,
		);
		expect(screen.getByLabelText("Front")).toHaveProperty("disabled", true);
		expect(screen.getByLabelText("Back")).toHaveProperty("disabled", true);
	});

	it("displays API error message", async () => {
		const user = userEvent.setup();

		vi.mocked(apiClient.rpc.api.decks[":deckId"].cards.$post).mockResolvedValue(
			mockResponse({
				ok: false,
				status: 400,
				json: async () => ({ error: "Card front cannot be empty" }),
			}),
		);

		render(<CreateCardModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Front"), "Question");
		await user.type(screen.getByLabelText("Back"), "Answer");
		await user.click(screen.getByRole("button", { name: "Create Card" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Card front cannot be empty",
			);
		});
	});

	it("displays generic error on unexpected failure", async () => {
		const user = userEvent.setup();

		vi.mocked(apiClient.rpc.api.decks[":deckId"].cards.$post).mockRejectedValue(
			new Error("Network error"),
		);

		render(<CreateCardModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Front"), "Question");
		await user.type(screen.getByLabelText("Back"), "Answer");
		await user.click(screen.getByRole("button", { name: "Create Card" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to create card. Please try again.",
			);
		});
	});

	it("resets form when closed and reopened", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		const { rerender } = render(
			<CreateCardModal
				isOpen={true}
				deckId="deck-123"
				onClose={onClose}
				onCardCreated={vi.fn()}
			/>,
		);

		// Type something in the form
		await user.type(screen.getByLabelText("Front"), "Question");
		await user.type(screen.getByLabelText("Back"), "Answer");

		// Click cancel to close
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		// Reopen the modal
		rerender(
			<CreateCardModal
				isOpen={true}
				deckId="deck-123"
				onClose={onClose}
				onCardCreated={vi.fn()}
			/>,
		);

		// Form should be reset
		expect(screen.getByLabelText("Front")).toHaveProperty("value", "");
		expect(screen.getByLabelText("Back")).toHaveProperty("value", "");
	});

	it("resets form after successful creation", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		vi.mocked(apiClient.rpc.api.decks[":deckId"].cards.$post).mockResolvedValue(
			mockResponse({
				ok: true,
				json: async () => ({ card: { id: "card-1" } }),
			}),
		);

		const { rerender } = render(
			<CreateCardModal
				isOpen={true}
				deckId="deck-123"
				onClose={onClose}
				onCardCreated={vi.fn()}
			/>,
		);

		// Create a card
		await user.type(screen.getByLabelText("Front"), "Question");
		await user.type(screen.getByLabelText("Back"), "Answer");
		await user.click(screen.getByRole("button", { name: "Create Card" }));

		await waitFor(() => {
			expect(onClose).toHaveBeenCalled();
		});

		// Reopen the modal
		rerender(
			<CreateCardModal
				isOpen={true}
				deckId="deck-123"
				onClose={onClose}
				onCardCreated={vi.fn()}
			/>,
		);

		// Form should be reset
		expect(screen.getByLabelText("Front")).toHaveProperty("value", "");
		expect(screen.getByLabelText("Back")).toHaveProperty("value", "");
	});
});
