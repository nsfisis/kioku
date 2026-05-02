import { atom, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
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

// Action atom - login
export const loginAtom = atom(
	null,
	async (
		_get,
		set,
		{ username, password }: { username: string; password: string },
	) => {
		const response = await apiClient.login(username, password);
		set(userAtom, response.user);
	},
);

// Action atom - logout. Wipes locally persisted user-scoped data so the next
// user (or a fresh re-login) starts from a clean IndexedDB. Session expiry
// (handled in useAuthInit) intentionally keeps local data so the user finds
// their offline work waiting after re-authenticating.
export const logoutAtom = atom(null, async (_get, set) => {
	await clearAllLocalData();
	apiClient.logout();
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
