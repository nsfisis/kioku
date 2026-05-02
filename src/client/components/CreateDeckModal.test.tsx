/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { atom } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();
const mockTriggerSync = vi.fn(() => Promise.resolve(null));

vi.mock("../db/repositories", () => ({
	localDeckRepository: {
		create: (...args: unknown[]) => mockCreate(...args),
	},
}));

vi.mock("../atoms", () => ({
	syncActionAtom: atom(null, () => mockTriggerSync()),
	userAtom: atom({ id: "user-1", username: "alice" }),
}));

import { CreateDeckModal } from "./CreateDeckModal";

describe("CreateDeckModal", () => {
	const defaultProps = {
		isOpen: true,
		onClose: vi.fn(),
		onDeckCreated: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockCreate.mockResolvedValue({
			id: "deck-1",
			userId: "user-1",
			name: "Test Deck",
			description: null,
			defaultNoteTypeId: null,
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
		expect(screen.getByRole("button", { name: "Create Deck" })).toBeDefined();
	});

	it("disables create button when name is empty", () => {
		render(<CreateDeckModal {...defaultProps} />);

		const createButton = screen.getByRole("button", { name: "Create Deck" });
		expect(createButton).toHaveProperty("disabled", true);
	});

	it("enables create button when name has content", async () => {
		const user = userEvent.setup();
		render(<CreateDeckModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "My Deck");

		const createButton = screen.getByRole("button", { name: "Create Deck" });
		expect(createButton).toHaveProperty("disabled", false);
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<CreateDeckModal {...defaultProps} onClose={onClose} />);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("creates deck via local repository with name only", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onDeckCreated = vi.fn();

		render(
			<CreateDeckModal
				isOpen={true}
				onClose={onClose}
				onDeckCreated={onDeckCreated}
			/>,
		);

		await user.type(screen.getByLabelText("Name"), "Test Deck");
		await user.click(screen.getByRole("button", { name: "Create Deck" }));

		await waitFor(() => {
			expect(mockCreate).toHaveBeenCalledWith({
				userId: "user-1",
				name: "Test Deck",
				description: null,
				defaultNoteTypeId: null,
			});
		});
		expect(onDeckCreated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("includes description when provided", async () => {
		const user = userEvent.setup();

		render(<CreateDeckModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "Test Deck");
		await user.type(
			screen.getByLabelText("Description (optional)"),
			"A test description",
		);
		await user.click(screen.getByRole("button", { name: "Create Deck" }));

		await waitFor(() => {
			expect(mockCreate).toHaveBeenCalledWith({
				userId: "user-1",
				name: "Test Deck",
				description: "A test description",
				defaultNoteTypeId: null,
			});
		});
	});

	it("trims whitespace from name and description", async () => {
		const user = userEvent.setup();

		render(<CreateDeckModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "  Test Deck  ");
		await user.type(
			screen.getByLabelText("Description (optional)"),
			"  Description  ",
		);
		await user.click(screen.getByRole("button", { name: "Create Deck" }));

		await waitFor(() => {
			expect(mockCreate).toHaveBeenCalledWith({
				userId: "user-1",
				name: "Test Deck",
				description: "Description",
				defaultNoteTypeId: null,
			});
		});
	});

	it("triggers a background sync after a successful create", async () => {
		const user = userEvent.setup();

		render(<CreateDeckModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "Test Deck");
		await user.click(screen.getByRole("button", { name: "Create Deck" }));

		await waitFor(() => {
			expect(mockTriggerSync).toHaveBeenCalled();
		});
	});

	it("shows loading state during submission", async () => {
		const user = userEvent.setup();

		mockCreate.mockImplementation(() => new Promise(() => {}));

		render(<CreateDeckModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "Test Deck");
		await user.click(screen.getByRole("button", { name: "Create Deck" }));

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

	it("displays a generic error when the local write fails", async () => {
		const user = userEvent.setup();

		mockCreate.mockRejectedValue(new Error("disk full"));

		render(<CreateDeckModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "Test Deck");
		await user.click(screen.getByRole("button", { name: "Create Deck" }));

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

		await user.type(screen.getByLabelText("Name"), "Test Deck");
		await user.type(
			screen.getByLabelText("Description (optional)"),
			"Test Description",
		);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		rerender(
			<CreateDeckModal
				isOpen={true}
				onClose={onClose}
				onDeckCreated={vi.fn()}
			/>,
		);

		expect(screen.getByLabelText("Name")).toHaveProperty("value", "");
		expect(screen.getByLabelText("Description (optional)")).toHaveProperty(
			"value",
			"",
		);
	});

	it("resets form after successful creation", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		const { rerender } = render(
			<CreateDeckModal
				isOpen={true}
				onClose={onClose}
				onDeckCreated={vi.fn()}
			/>,
		);

		await user.type(screen.getByLabelText("Name"), "Test Deck");
		await user.click(screen.getByRole("button", { name: "Create Deck" }));

		await waitFor(() => {
			expect(onClose).toHaveBeenCalled();
		});

		rerender(
			<CreateDeckModal
				isOpen={true}
				onClose={onClose}
				onDeckCreated={vi.fn()}
			/>,
		);

		expect(screen.getByLabelText("Name")).toHaveProperty("value", "");
		expect(screen.getByLabelText("Description (optional)")).toHaveProperty(
			"value",
			"",
		);
	});
});
