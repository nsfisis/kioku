/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
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
import { SyncStatusIndicator } from "./SyncStatusIndicator";

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

	return render(
		<Provider store={store}>
			<SyncStatusIndicator />
		</Provider>,
	);
}

describe("SyncStatusIndicator", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("displays 'Synced' when online with no pending changes", () => {
		renderWithStore({
			isOnline: true,
			isSyncing: false,
			pendingCount: 0,
			lastError: null,
			status: SyncStatus.Idle,
		});

		expect(screen.getByText("Synced")).toBeDefined();
		expect(screen.getByTestId("sync-status-indicator")).toBeDefined();
	});

	it("displays 'Offline' when not online", () => {
		renderWithStore({
			isOnline: false,
			isSyncing: false,
			pendingCount: 0,
			lastError: null,
			status: SyncStatus.Idle,
		});

		expect(screen.getByText("Offline")).toBeDefined();
	});

	it("displays 'Syncing...' when syncing", () => {
		renderWithStore({
			isOnline: true,
			isSyncing: true,
			pendingCount: 0,
			lastError: null,
			status: SyncStatus.Syncing,
		});

		expect(screen.getByText("Syncing...")).toBeDefined();
	});

	it("displays pending count when there are pending changes", () => {
		renderWithStore({
			isOnline: true,
			isSyncing: false,
			pendingCount: 5,
			lastError: null,
			status: SyncStatus.Idle,
		});

		expect(screen.getByText("5 pending")).toBeDefined();
	});

	it("displays 'Sync error' when there is an error", () => {
		renderWithStore({
			isOnline: true,
			isSyncing: false,
			pendingCount: 0,
			lastError: "Network error",
			status: SyncStatus.Error,
		});

		expect(screen.getByText("Sync error")).toBeDefined();
	});

	it("shows error message in title when there is an error", () => {
		renderWithStore({
			isOnline: true,
			isSyncing: false,
			pendingCount: 0,
			lastError: "Network error",
			status: SyncStatus.Error,
		});

		const indicator = screen.getByTestId("sync-status-indicator");
		expect(indicator.getAttribute("title")).toBe("Network error");
	});

	it("prioritizes offline status over other states", () => {
		renderWithStore({
			isOnline: false,
			isSyncing: true,
			pendingCount: 5,
			lastError: "Error",
			status: SyncStatus.Error,
		});

		expect(screen.getByText("Offline")).toBeDefined();
	});

	it("prioritizes syncing status over pending and error", () => {
		renderWithStore({
			isOnline: true,
			isSyncing: true,
			pendingCount: 5,
			lastError: null,
			status: SyncStatus.Syncing,
		});

		expect(screen.getByText("Syncing...")).toBeDefined();
	});

	it("prioritizes error status over pending", () => {
		renderWithStore({
			isOnline: true,
			isSyncing: false,
			pendingCount: 5,
			lastError: "Network error",
			status: SyncStatus.Error,
		});

		expect(screen.getByText("Sync error")).toBeDefined();
	});
});
