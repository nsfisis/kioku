/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/index";
import { SyncProvider, useSync } from "./sync";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock apiClient
vi.mock("../api/client", () => ({
	apiClient: {
		getAuthHeader: vi.fn(() => ({ Authorization: "Bearer token" })),
		authenticatedFetch: vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
			mockFetch(input, init),
		),
	},
}));

const wrapper = ({ children }: { children: ReactNode }) => (
	<SyncProvider>{children}</SyncProvider>
);

describe("useSync", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		localStorage.clear();
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();

		// Default mock for fetch
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: {
					decks: [],
					cards: [],
					noteTypes: [],
					noteFieldTypes: [],
					notes: [],
					noteFieldValues: [],
				},
				currentSyncVersion: 0,
			}),
		});
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		localStorage.clear();
		await db.decks.clear();
		await db.cards.clear();
		await db.reviewLogs.clear();
	});

	it("throws error when used outside SyncProvider", () => {
		// Suppress console.error for this test
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		expect(() => {
			renderHook(() => useSync());
		}).toThrow("useSync must be used within a SyncProvider");

		consoleSpy.mockRestore();
	});

	it("returns initial state", async () => {
		const { result } = renderHook(() => useSync(), { wrapper });

		await waitFor(() => {
			expect(result.current.isOnline).toBe(true);
			expect(result.current.isSyncing).toBe(false);
			expect(result.current.pendingCount).toBe(0);
			expect(result.current.lastSyncAt).toBeNull();
			expect(result.current.lastError).toBeNull();
			expect(result.current.status).toBe("idle");
		});
	});

	it("provides sync function", async () => {
		const { result } = renderHook(() => useSync(), { wrapper });

		await waitFor(() => {
			expect(typeof result.current.sync).toBe("function");
		});
	});

	it("updates isSyncing during sync", async () => {
		// Make the sync take some time
		mockFetch.mockImplementation(
			() =>
				new Promise((resolve) =>
					setTimeout(
						() =>
							resolve({
								ok: true,
								json: async () => ({
									decks: [],
									cards: [],
									reviewLogs: [],
									conflicts: { decks: [], cards: [] },
									currentSyncVersion: 0,
								}),
							}),
						50,
					),
				),
		);

		const { result } = renderHook(() => useSync(), { wrapper });

		await waitFor(() => {
			expect(result.current.isSyncing).toBe(false);
		});

		// Start sync
		let syncPromise: Promise<unknown>;
		act(() => {
			syncPromise = result.current.sync();
		});

		// Check that isSyncing becomes true
		await waitFor(() => {
			expect(result.current.isSyncing).toBe(true);
		});

		// Wait for sync to complete
		await act(async () => {
			await syncPromise;
		});

		expect(result.current.isSyncing).toBe(false);
	});

	it("updates lastSyncAt after successful sync", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				decks: [],
				cards: [],
				reviewLogs: [],
				noteTypes: [],
				noteFieldTypes: [],
				notes: [],
				noteFieldValues: [],
				conflicts: {
					decks: [],
					cards: [],
					noteTypes: [],
					noteFieldTypes: [],
					notes: [],
					noteFieldValues: [],
				},
				currentSyncVersion: 1,
			}),
		});

		const { result } = renderHook(() => useSync(), { wrapper });

		await waitFor(() => {
			expect(result.current.lastSyncAt).toBeNull();
		});

		await act(async () => {
			await result.current.sync();
		});

		await waitFor(() => {
			expect(result.current.lastSyncAt).not.toBeNull();
		});
	});

	it("updates lastError on sync failure", async () => {
		mockFetch.mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({ error: "Server error" }),
		});

		const { result } = renderHook(() => useSync(), { wrapper });

		await waitFor(() => {
			expect(result.current.lastError).toBeNull();
		});

		await act(async () => {
			await result.current.sync();
		});

		await waitFor(() => {
			expect(result.current.lastError).toBe("Server error");
			expect(result.current.status).toBe("error");
		});
	});

	it("responds to online/offline events", async () => {
		const { result } = renderHook(() => useSync(), { wrapper });

		await waitFor(() => {
			expect(result.current.isOnline).toBe(true);
		});

		// Simulate going offline
		act(() => {
			window.dispatchEvent(new Event("offline"));
		});

		await waitFor(() => {
			expect(result.current.isOnline).toBe(false);
		});

		// Simulate going online
		act(() => {
			window.dispatchEvent(new Event("online"));
		});

		await waitFor(() => {
			expect(result.current.isOnline).toBe(true);
		});
	});
});
