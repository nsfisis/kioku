/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isOnlineAtom, pendingCountAtom } from "../atoms";
import { OfflineBanner } from "./OfflineBanner";

function renderWithStore(atomValues: {
	isOnline: boolean;
	pendingCount: number;
}) {
	const store = createStore();
	store.set(isOnlineAtom, atomValues.isOnline);
	store.set(pendingCountAtom, atomValues.pendingCount);

	return render(
		<Provider store={store}>
			<OfflineBanner />
		</Provider>,
	);
}

describe("OfflineBanner", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("renders nothing when online", () => {
		renderWithStore({
			isOnline: true,
			pendingCount: 0,
		});

		expect(screen.queryByTestId("offline-banner")).toBeNull();
	});

	it("renders banner when offline", () => {
		renderWithStore({
			isOnline: false,
			pendingCount: 0,
		});

		const banner = screen.getByTestId("offline-banner");
		expect(banner).toBeDefined();
		expect(
			screen.getByText(/You're offline. Changes will sync when you reconnect./),
		).toBeDefined();
	});

	it("displays pending count when offline with pending changes", () => {
		renderWithStore({
			isOnline: false,
			pendingCount: 5,
		});

		expect(screen.getByTestId("offline-pending-count")).toBeDefined();
		expect(screen.getByText("(5 pending)")).toBeDefined();
	});

	it("does not display pending count when there are no pending changes", () => {
		renderWithStore({
			isOnline: false,
			pendingCount: 0,
		});

		expect(screen.queryByTestId("offline-pending-count")).toBeNull();
	});

	it("has correct accessibility attributes", () => {
		renderWithStore({
			isOnline: false,
			pendingCount: 0,
		});

		const banner = screen.getByTestId("offline-banner");
		// <output> element has implicit role="status", so we check it's an output element
		expect(banner.tagName.toLowerCase()).toBe("output");
		expect(banner.getAttribute("aria-live")).toBe("polite");
	});
});
