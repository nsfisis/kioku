/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncStatusIndicator } from "./SyncStatusIndicator";

// Mock the useSync hook
const mockUseSync = vi.fn();
vi.mock("../stores", () => ({
	useSync: () => mockUseSync(),
}));

// Mock the SyncStatus constant
vi.mock("../sync", () => ({
	SyncStatus: {
		Idle: "idle",
		Syncing: "syncing",
		Error: "error",
	},
}));

describe("SyncStatusIndicator", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("displays 'Synced' when online with no pending changes", () => {
		mockUseSync.mockReturnValue({
			isOnline: true,
			isSyncing: false,
			pendingCount: 0,
			lastError: null,
			status: "idle",
		});

		render(<SyncStatusIndicator />);

		expect(screen.getByText("Synced")).toBeDefined();
		expect(screen.getByTestId("sync-status-indicator")).toBeDefined();
	});

	it("displays 'Offline' when not online", () => {
		mockUseSync.mockReturnValue({
			isOnline: false,
			isSyncing: false,
			pendingCount: 0,
			lastError: null,
			status: "idle",
		});

		render(<SyncStatusIndicator />);

		expect(screen.getByText("Offline")).toBeDefined();
	});

	it("displays 'Syncing...' when syncing", () => {
		mockUseSync.mockReturnValue({
			isOnline: true,
			isSyncing: true,
			pendingCount: 0,
			lastError: null,
			status: "syncing",
		});

		render(<SyncStatusIndicator />);

		expect(screen.getByText("Syncing...")).toBeDefined();
	});

	it("displays pending count when there are pending changes", () => {
		mockUseSync.mockReturnValue({
			isOnline: true,
			isSyncing: false,
			pendingCount: 5,
			lastError: null,
			status: "idle",
		});

		render(<SyncStatusIndicator />);

		expect(screen.getByText("5 pending")).toBeDefined();
	});

	it("displays 'Sync error' when there is an error", () => {
		mockUseSync.mockReturnValue({
			isOnline: true,
			isSyncing: false,
			pendingCount: 0,
			lastError: "Network error",
			status: "error",
		});

		render(<SyncStatusIndicator />);

		expect(screen.getByText("Sync error")).toBeDefined();
	});

	it("shows error message in title when there is an error", () => {
		mockUseSync.mockReturnValue({
			isOnline: true,
			isSyncing: false,
			pendingCount: 0,
			lastError: "Network error",
			status: "error",
		});

		render(<SyncStatusIndicator />);

		const indicator = screen.getByTestId("sync-status-indicator");
		expect(indicator.getAttribute("title")).toBe("Network error");
	});

	it("prioritizes offline status over other states", () => {
		mockUseSync.mockReturnValue({
			isOnline: false,
			isSyncing: true,
			pendingCount: 5,
			lastError: "Error",
			status: "error",
		});

		render(<SyncStatusIndicator />);

		expect(screen.getByText("Offline")).toBeDefined();
	});

	it("prioritizes syncing status over pending and error", () => {
		mockUseSync.mockReturnValue({
			isOnline: true,
			isSyncing: true,
			pendingCount: 5,
			lastError: null,
			status: "syncing",
		});

		render(<SyncStatusIndicator />);

		expect(screen.getByText("Syncing...")).toBeDefined();
	});

	it("prioritizes error status over pending", () => {
		mockUseSync.mockReturnValue({
			isOnline: true,
			isSyncing: false,
			pendingCount: 5,
			lastError: "Network error",
			status: "error",
		});

		render(<SyncStatusIndicator />);

		expect(screen.getByText("Sync error")).toBeDefined();
	});
});
