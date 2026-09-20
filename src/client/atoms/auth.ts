import { atom, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { queryClientAtom } from "jotai-tanstack-query";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { apiClient, type User } from "../api/client";
import { clearAllLocalData } from "../db/clear";

// userAtom is the single source of truth for auth state. Persisted to
// localStorage so that the authenticated user survives page reloads alongside
// the tokens in apiClient's token storage.
export const userAtom = atomWithStorage<User | null>("kioku_user", null);
export const authLoadingAtom = atom<boolean>(true);

export const isAuthenticatedAtom = atom<boolean>(
	(get) => get(userAtom) !== null,
);

// Bumped on every sign-in and sign-out. User-scoped query atoms read it so that
// a new session rebuilds them instead of replaying what the previous one left
// cached — most visibly the "Invalid or expired token" error of the request
// that ended that session.
export const sessionGenerationAtom = atom<number>(0);

// Action atom - login
export const loginAtom = atom(
	null,
	async (
		get,
		set,
		{ username, password }: { username: string; password: string },
	) => {
		const response = await apiClient.login(username, password);
		// Discard everything the dead session cached before handing the app to
		// the new one. Failed queries are cached too, so without this a re-login
		// lands on the previous session's error until the page is reloaded.
		get(queryClientAtom).clear();
		set(sessionGenerationAtom, (generation) => generation + 1);
		set(userAtom, response.user);
	},
);

// Action atom - logout. Wipes locally persisted user-scoped data so the next
// user (or a fresh re-login) starts from a clean IndexedDB. Session expiry
// (handled in useAuthInit) intentionally keeps local data so the user finds
// their offline work waiting after re-authenticating.
export const logoutAtom = atom(null, async (get, set) => {
	await clearAllLocalData();
	apiClient.logout();
	get(queryClientAtom).clear();
	set(sessionGenerationAtom, (generation) => generation + 1);
	set(userAtom, null);
});

// Hook to initialize auth state and subscribe to session expiration
export function useAuthInit() {
	const setAuthLoading = useSetAtom(authLoadingAtom);
	const setUser = useSetAtom(userAtom);
	const [, navigate] = useLocation();

	useEffect(() => {
		setAuthLoading(false);

		// Subscribe to session expired events from the API client
		const unsubscribe = apiClient.onSessionExpired(() => {
			apiClient.logout();
			setUser(null);
			navigate("/login", { replace: true });
		});

		return unsubscribe;
	}, [setAuthLoading, setUser, navigate]);
}
