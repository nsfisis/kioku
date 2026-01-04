import { atom, useSetAtom } from "jotai";
import { useEffect } from "react";
import { apiClient, type User } from "../api/client";

// Primitive atoms
export const userAtom = atom<User | null>(null);
export const authLoadingAtom = atom<boolean>(true);

// Derived atom - checks if user is authenticated via apiClient
export const isAuthenticatedAtom = atom<boolean>((get) => {
	// We need to trigger re-evaluation when user changes
	get(userAtom);
	return apiClient.isAuthenticated();
});

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

// Action atom - logout
export const logoutAtom = atom(null, (_get, set) => {
	apiClient.logout();
	set(userAtom, null);
});

// Hook to initialize auth state and subscribe to session expiration
export function useAuthInit() {
	const setAuthLoading = useSetAtom(authLoadingAtom);
	const setUser = useSetAtom(userAtom);

	useEffect(() => {
		// Check for existing auth on mount
		const tokens = apiClient.getTokens();
		if (tokens) {
			// We have tokens stored, but we don't have user info cached
			// For now, just set authenticated state. User info will be fetched when needed.
		}
		setAuthLoading(false);

		// Subscribe to session expired events from the API client
		const unsubscribe = apiClient.onSessionExpired(() => {
			apiClient.logout();
			setUser(null);
		});

		return unsubscribe;
	}, [setAuthLoading, setUser]);
}
