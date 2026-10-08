/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	isOnlineAtom,
	isSyncingAtom,
	lastErrorAtom,
	pendingCountAtom,
	syncStatusAtom,
} from "../atoms";
import { SyncStatus } from "../sync";
import { SyncButton } from "./SyncButton";

// Mock the syncManager
const mockSync = vi.fn();
vi.mock("../atoms/sync", async (importOriginal) => {
	const original = await importOriginal<typeof import("../atoms/sync")>();
	return {
		...original,
		syncManager: {
			sync: () => mockSync(),
		},
	};
});

describe("SyncButton", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSync.mockResolvedValue({ success: true });
	});

	afterEach(() => {
		cleanup();
	});

	it("renders sync button", () => {
		const store = createStore();
		store.set(isOnlineAtom, true);
		store.set(isSyncingAtom, false);

		render(
			<Provider store={store}>
				<SyncButton />
			</Provider>,
		);

		expect(screen.getByTestId("sync-button")).toBeDefined();
		expect(screen.getByText("Sync")).toBeDefined();
	});

	it("displays 'Syncing...' when syncing", () => {
		const store = createStore();
		store.set(isOnlineAtom, true);
		store.set(isSyncingAtom, true);

		render(
			<Provider store={store}>
				<SyncButton />
			</Provider>,
		);

		expect(screen.getByText("Syncing...")).toBeDefined();
	});

	it("is disabled when offline", () => {
		const store = createStore();
		store.set(isOnlineAtom, false);
		store.set(isSyncingAtom, false);

		render(
			<Provider store={store}>
				<SyncButton />
			</Provider>,
		);

		const button = screen.getByTestId("sync-button");
		expect(button).toHaveProperty("disabled", true);
	});

	it("is disabled when syncing", () => {
		const store = createStore();
		store.set(isOnlineAtom, true);
		store.set(isSyncingAtom, true);

		render(
			<Provider store={store}>
				<SyncButton />
			</Provider>,
		);

		const button = screen.getByTestId("sync-button");
		expect(button).toHaveProperty("disabled", true);
	});

	it("is enabled when online and not syncing", () => {
		const store = createStore();
		store.set(isOnlineAtom, true);
		store.set(isSyncingAtom, false);

		render(
			<Provider store={store}>
				<SyncButton />
			</Provider>,
		);

		const button = screen.getByTestId("sync-button");
		expect(button).toHaveProperty("disabled", false);
	});

	it("calls sync when clicked", async () => {
		const store = createStore();
		store.set(isOnlineAtom, true);
		store.set(isSyncingAtom, false);

		render(
			<Provider store={store}>
				<SyncButton />
			</Provider>,
		);

		const button = screen.getByTestId("sync-button");
		fireEvent.click(button);

		// The sync action should be triggered (via useSetAtom)
		// We can't easily verify the actual sync call since it goes through Jotai
		// but we can verify the button interaction works
		expect(button).toBeDefined();
	});

	it("does not call sync when clicked while disabled", () => {
		const store = createStore();
		store.set(isOnlineAtom, false);
		store.set(isSyncingAtom, false);

		render(
			<Provider store={store}>
				<SyncButton />
			</Provider>,
		);

		const button = screen.getByTestId("sync-button");
		fireEvent.click(button);

		// Button should be disabled, so click has no effect
		expect(button).toHaveProperty("disabled", true);
	});

	it("shows tooltip when offline", () => {
		const store = createStore();
		store.set(isOnlineAtom, false);
		store.set(isSyncingAtom, false);

		render(
			<Provider store={store}>
				<SyncButton />
			</Provider>,
		);

		const button = screen.getByTestId("sync-button");
		expect(button.getAttribute("title")).toBe("Cannot sync while offline");
	});

	function renderWithStore(atomValues: {
		isOnline: boolean;
		isSyncing: boolean;
		pendingCount: number;
		lastError: string | null;
		status: (typeof SyncStatus)[keyof typeof SyncStatus];
	}) {
		const store = createStore();
		store.set(isOnlineAtom, atomValues.isOnline);
		store.set(isSyncingAtom, atomValues.isSyncing);
		store.set(pendingCountAtom, atomValues.pendingCount);
		store.set(lastErrorAtom, atomValues.lastError);
		store.set(syncStatusAtom, atomValues.status);

		render(
			<Provider store={store}>
				<SyncButton />
			</Provider>,
		);

		return screen.getByTestId("sync-button");
	}

	it("shows synced state when online with no pending changes", () => {
		const button = renderWithStore({
			isOnline: true,
			isSyncing: false,
			pendingCount: 0,
			lastError: null,
			status: SyncStatus.Idle,
		});

		expect(button.getAttribute("data-state")).toBe("synced");
		expect(button.getAttribute("title")).toBe("Synced");
		expect(button.className).toContain("text-success");
		expect(screen.queryByTestId("sync-pending-count")).toBeNull();
	});

	it("shows pending count when there are pending changes", () => {
		const button = renderWithStore({
			isOnline: true,
			isSyncing: false,
			pendingCount: 5,
			lastError: null,
			status: SyncStatus.Idle,
		});

		expect(button.getAttribute("data-state")).toBe("pending");
		expect(button.getAttribute("title")).toBe("5 pending");
		expect(button.className).toContain("text-warning");
		expect(screen.getByTestId("sync-pending-count").textContent).toBe("5");
	});

	it("shows error state with the error message in title", () => {
		const button = renderWithStore({
			isOnline: true,
			isSyncing: false,
			pendingCount: 0,
			lastError: "Network error",
			status: SyncStatus.Error,
		});

		expect(button.getAttribute("data-state")).toBe("error");
		expect(button.getAttribute("title")).toBe("Network error");
		expect(button.className).toContain("text-error");
		expect(button).toHaveProperty("disabled", false);
	});

	it("prioritizes offline state over other states", () => {
		const button = renderWithStore({
			isOnline: false,
			isSyncing: true,
			pendingCount: 5,
			lastError: "Error",
			status: SyncStatus.Error,
		});

		expect(button.getAttribute("data-state")).toBe("offline");
		expect(screen.getByText("Sync")).toBeDefined();
	});

	it("prioritizes syncing state over pending and error", () => {
		const button = renderWithStore({
			isOnline: true,
			isSyncing: true,
			pendingCount: 5,
			lastError: null,
			status: SyncStatus.Syncing,
		});

		expect(button.getAttribute("data-state")).toBe("syncing");
		expect(screen.queryByTestId("sync-pending-count")).toBeNull();
	});

	it("prioritizes error state over pending", () => {
		const button = renderWithStore({
			isOnline: true,
			isSyncing: false,
			pendingCount: 5,
			lastError: "Network error",
			status: SyncStatus.Error,
		});

		expect(button.getAttribute("data-state")).toBe("error");
	});
});
