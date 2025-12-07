/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineBanner } from "./OfflineBanner";

// Mock the useSync hook
const mockUseSync = vi.fn();
vi.mock("../stores", () => ({
	useSync: () => mockUseSync(),
}));

describe("OfflineBanner", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		cleanup();
	});

	it("renders nothing when online", () => {
		mockUseSync.mockReturnValue({
			isOnline: true,
			pendingCount: 0,
		});

		render(<OfflineBanner />);

		expect(screen.queryByTestId("offline-banner")).toBeNull();
	});

	it("renders banner when offline", () => {
		mockUseSync.mockReturnValue({
			isOnline: false,
			pendingCount: 0,
		});

		render(<OfflineBanner />);

		const banner = screen.getByTestId("offline-banner");
		expect(banner).toBeDefined();
		expect(
			screen.getByText(/You're offline. Changes will sync when you reconnect./),
		).toBeDefined();
	});

	it("displays pending count when offline with pending changes", () => {
		mockUseSync.mockReturnValue({
			isOnline: false,
			pendingCount: 5,
		});

		render(<OfflineBanner />);

		expect(screen.getByTestId("offline-pending-count")).toBeDefined();
		expect(screen.getByText("(5 pending)")).toBeDefined();
	});

	it("does not display pending count when there are no pending changes", () => {
		mockUseSync.mockReturnValue({
			isOnline: false,
			pendingCount: 0,
		});

		render(<OfflineBanner />);

		expect(screen.queryByTestId("offline-pending-count")).toBeNull();
	});

	it("has correct accessibility attributes", () => {
		mockUseSync.mockReturnValue({
			isOnline: false,
			pendingCount: 0,
		});

		render(<OfflineBanner />);

		const banner = screen.getByTestId("offline-banner");
		// <output> element has implicit role="status", so we check it's an output element
		expect(banner.tagName.toLowerCase()).toBe("output");
		expect(banner.getAttribute("aria-live")).toBe("polite");
	});
});
