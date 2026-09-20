/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { QueryClient } from "@tanstack/query-core";
import { createStore } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loginAtom, logoutAtom, userAtom } from "./auth";
import { decksAtom } from "./decks";

const mocks = vi.hoisted(() => ({
	login: vi.fn(),
	logout: vi.fn(),
	clearAllLocalData: vi.fn(async () => {}),
	findByUserId: vi.fn(),
}));

vi.mock("../api/client", () => ({
	apiClient: {
		login: mocks.login,
		logout: mocks.logout,
		onSessionExpired: vi.fn(() => vi.fn()),
	},
}));

vi.mock("../db/clear", () => ({
	clearAllLocalData: mocks.clearAllLocalData,
}));

vi.mock("../db/repositories", () => ({
	localDeckRepository: {
		findByUserId: mocks.findByUserId,
		findById: vi.fn(),
	},
}));

vi.mock("./sync", () => ({
	ensureBootstrap: vi.fn(async () => {}),
}));

const alice = { id: "user-1", username: "alice" };

function createTestStore() {
	const store = createStore();
	store.set(
		queryClientAtom,
		new QueryClient({
			defaultOptions: { queries: { staleTime: 0, retry: false } },
		}),
	);
	return store;
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.login.mockResolvedValue({
		accessToken: "new-access-token",
		refreshToken: "new-refresh-token",
		user: alice,
	});
});

afterEach(() => {
	localStorage.clear();
});

describe("loginAtom", () => {
	it("does not replay the expired session's error after signing in again", async () => {
		const store = createTestStore();
		store.set(userAtom, alice);

		// The access token expired, so the deck query fails with the message the
		// server sends back. The page shows it through its ErrorBoundary.
		mocks.findByUserId.mockRejectedValueOnce(
			new Error("Invalid or expired token"),
		);
		await expect(store.get(decksAtom)).rejects.toThrow(
			"Invalid or expired token",
		);

		// Session expiry signs the user out and redirects to /login.
		store.set(userAtom, null);

		// The user signs in again with a valid username and password.
		mocks.findByUserId.mockResolvedValue([]);
		await store.set(loginAtom, { username: "alice", password: "secret" });

		// Back on the deck list, the stale error must not resurface.
		const result = await store.get(decksAtom);
		expect(result.data).toEqual([]);
	});
});

describe("logoutAtom", () => {
	it("drops cached server data so the next user cannot see it", async () => {
		const store = createTestStore();
		store.set(userAtom, alice);
		mocks.findByUserId.mockResolvedValue([]);

		await store.get(decksAtom);
		expect(store.get(queryClientAtom).getQueryData(["decks"])).toEqual([]);

		await store.set(logoutAtom);

		expect(store.get(queryClientAtom).getQueryData(["decks"])).toBeUndefined();
	});
});
