/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncButton } from "./SyncButton";

// Mock the useSync hook
const mockSync = vi.fn();
const mockUseSync = vi.fn();
vi.mock("../stores", () => ({
	useSync: () => mockUseSync(),
}));

describe("SyncButton", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSync.mockResolvedValue({ success: true });
	});

	afterEach(() => {
		cleanup();
	});

	it("renders sync button", () => {
		mockUseSync.mockReturnValue({
			isOnline: true,
			isSyncing: false,
			sync: mockSync,
		});

		render(<SyncButton />);

		expect(screen.getByTestId("sync-button")).toBeDefined();
		expect(screen.getByText("Sync")).toBeDefined();
	});

	it("displays 'Syncing...' when syncing", () => {
		mockUseSync.mockReturnValue({
			isOnline: true,
			isSyncing: true,
			sync: mockSync,
		});

		render(<SyncButton />);

		expect(screen.getByText("Syncing...")).toBeDefined();
	});

	it("is disabled when offline", () => {
		mockUseSync.mockReturnValue({
			isOnline: false,
			isSyncing: false,
			sync: mockSync,
		});

		render(<SyncButton />);

		const button = screen.getByTestId("sync-button");
		expect(button).toHaveProperty("disabled", true);
	});

	it("is disabled when syncing", () => {
		mockUseSync.mockReturnValue({
			isOnline: true,
			isSyncing: true,
			sync: mockSync,
		});

		render(<SyncButton />);

		const button = screen.getByTestId("sync-button");
		expect(button).toHaveProperty("disabled", true);
	});

	it("is enabled when online and not syncing", () => {
		mockUseSync.mockReturnValue({
			isOnline: true,
			isSyncing: false,
			sync: mockSync,
		});

		render(<SyncButton />);

		const button = screen.getByTestId("sync-button");
		expect(button).toHaveProperty("disabled", false);
	});

	it("calls sync when clicked", async () => {
		mockUseSync.mockReturnValue({
			isOnline: true,
			isSyncing: false,
			sync: mockSync,
		});

		render(<SyncButton />);

		const button = screen.getByTestId("sync-button");
		fireEvent.click(button);

		expect(mockSync).toHaveBeenCalledTimes(1);
	});

	it("does not call sync when clicked while disabled", () => {
		mockUseSync.mockReturnValue({
			isOnline: false,
			isSyncing: false,
			sync: mockSync,
		});

		render(<SyncButton />);

		const button = screen.getByTestId("sync-button");
		fireEvent.click(button);

		expect(mockSync).not.toHaveBeenCalled();
	});

	it("shows tooltip when offline", () => {
		mockUseSync.mockReturnValue({
			isOnline: false,
			isSyncing: false,
			sync: mockSync,
		});

		render(<SyncButton />);

		const button = screen.getByTestId("sync-button");
		expect(button.getAttribute("title")).toBe("Cannot sync while offline");
	});

	it("does not show tooltip when online", () => {
		mockUseSync.mockReturnValue({
			isOnline: true,
			isSyncing: false,
			sync: mockSync,
		});

		render(<SyncButton />);

		const button = screen.getByTestId("sync-button");
		expect(button.getAttribute("title")).toBeNull();
	});
});
