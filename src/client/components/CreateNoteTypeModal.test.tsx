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
	localNoteTypeRepository: {
		create: (...args: unknown[]) => mockCreate(...args),
	},
}));

vi.mock("../atoms", () => ({
	syncActionAtom: atom(null, () => mockTriggerSync()),
	userAtom: atom({ id: "user-1", username: "alice" }),
}));

import { CreateNoteTypeModal } from "./CreateNoteTypeModal";

describe("CreateNoteTypeModal", () => {
	const defaultProps = {
		isOpen: true,
		onClose: vi.fn(),
		onNoteTypeCreated: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockCreate.mockResolvedValue({
			id: "note-type-1",
			userId: "user-1",
			name: "Test Note Type",
			frontTemplate: "{{Front}}",
			backTemplate: "{{Back}}",
			isReversible: false,
		});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("does not render when closed", () => {
		render(<CreateNoteTypeModal {...defaultProps} isOpen={false} />);

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders modal when open", () => {
		render(<CreateNoteTypeModal {...defaultProps} />);

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(
			screen.getByRole("heading", { name: "Create Note Type" }),
		).toBeDefined();
		expect(screen.getByLabelText("Name")).toBeDefined();
		expect(screen.getByLabelText("Front Template")).toBeDefined();
		expect(screen.getByLabelText("Back Template")).toBeDefined();
		expect(screen.getByLabelText("Create reversed cards")).toBeDefined();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Create" })).toBeDefined();
	});

	it("has default template values", () => {
		render(<CreateNoteTypeModal {...defaultProps} />);

		expect(screen.getByLabelText("Front Template")).toHaveProperty(
			"value",
			"{{Front}}",
		);
		expect(screen.getByLabelText("Back Template")).toHaveProperty(
			"value",
			"{{Back}}",
		);
	});

	it("disables create button when name is empty", () => {
		render(<CreateNoteTypeModal {...defaultProps} />);

		const createButton = screen.getByRole("button", { name: "Create" });
		expect(createButton).toHaveProperty("disabled", true);
	});

	it("enables create button when name has content", async () => {
		const user = userEvent.setup();
		render(<CreateNoteTypeModal {...defaultProps} />);

		const nameInput = screen.getByLabelText("Name");
		await user.type(nameInput, "My Note Type");

		const createButton = screen.getByRole("button", { name: "Create" });
		expect(createButton).toHaveProperty("disabled", false);
	});

	it("calls onClose when Cancel is clicked", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		render(<CreateNoteTypeModal {...defaultProps} onClose={onClose} />);

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("creates note type via local repository with all fields", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onNoteTypeCreated = vi.fn();

		render(
			<CreateNoteTypeModal
				isOpen={true}
				onClose={onClose}
				onNoteTypeCreated={onNoteTypeCreated}
			/>,
		);

		await user.type(screen.getByLabelText("Name"), "Test Note Type");
		await user.click(screen.getByLabelText("Create reversed cards"));
		await user.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(mockCreate).toHaveBeenCalledWith({
				userId: "user-1",
				name: "Test Note Type",
				frontTemplate: "{{Front}}",
				backTemplate: "{{Back}}",
				isReversible: true,
			});
		});

		expect(onNoteTypeCreated).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("trims whitespace from text fields", async () => {
		const user = userEvent.setup();

		render(<CreateNoteTypeModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "  Test Note Type  ");
		await user.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "Test Note Type",
				}),
			);
		});
	});

	it("triggers a background sync after a successful create", async () => {
		const user = userEvent.setup();

		render(<CreateNoteTypeModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "Test Note Type");
		await user.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(mockTriggerSync).toHaveBeenCalled();
		});
	});

	it("shows loading state during submission", async () => {
		const user = userEvent.setup();

		mockCreate.mockImplementation(() => new Promise(() => {}));

		render(<CreateNoteTypeModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "Test Note Type");
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
	});

	it("displays a generic error when the local write fails", async () => {
		const user = userEvent.setup();

		mockCreate.mockRejectedValue(new Error("disk full"));

		render(<CreateNoteTypeModal {...defaultProps} />);

		await user.type(screen.getByLabelText("Name"), "Test Note Type");
		await user.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toContain(
				"Failed to create note type. Please try again.",
			);
		});
	});

	it("resets form when closed and reopened", async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		const { rerender } = render(
			<CreateNoteTypeModal
				isOpen={true}
				onClose={onClose}
				onNoteTypeCreated={vi.fn()}
			/>,
		);

		await user.type(screen.getByLabelText("Name"), "Test Note Type");
		await user.click(screen.getByLabelText("Create reversed cards"));

		await user.click(screen.getByRole("button", { name: "Cancel" }));

		rerender(
			<CreateNoteTypeModal
				isOpen={true}
				onClose={onClose}
				onNoteTypeCreated={vi.fn()}
			/>,
		);

		expect(screen.getByLabelText("Name")).toHaveProperty("value", "");
		expect(screen.getByLabelText("Front Template")).toHaveProperty(
			"value",
			"{{Front}}",
		);
		expect(screen.getByLabelText("Back Template")).toHaveProperty(
			"value",
			"{{Back}}",
		);
		expect(screen.getByLabelText("Create reversed cards")).toHaveProperty(
			"checked",
			false,
		);
	});
});
