import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { ApiClientError, apiClient } from "../api/client";
import type { User } from "../api/types";

export interface AuthState {
	user: User | null;
	isAuthenticated: boolean;
	isLoading: boolean;
}

export interface AuthActions {
	login: (username: string, password: string) => Promise<void>;
	register: (username: string, password: string) => Promise<void>;
	logout: () => void;
}

export type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
	children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
	const [user, setUser] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	// Check for existing auth on mount
	useEffect(() => {
		const tokens = apiClient.getTokens();
		if (tokens) {
			// We have tokens stored, but we don't have user info cached
			// For now, just set authenticated state. User info will be fetched when needed.
			// In a full implementation, we'd decode the JWT or call an API endpoint
			setIsLoading(false);
		} else {
			setIsLoading(false);
		}
	}, []);

	const login = useCallback(async (username: string, password: string) => {
		const response = await apiClient.login(username, password);
		setUser(response.user);
	}, []);

	const register = useCallback(
		async (username: string, password: string) => {
			await apiClient.register(username, password);
			// After registration, log in automatically
			await login(username, password);
		},
		[login],
	);

	const logout = useCallback(() => {
		apiClient.logout();
		setUser(null);
	}, []);

	const isAuthenticated = apiClient.isAuthenticated();

	const value = useMemo<AuthContextValue>(
		() => ({
			user,
			isAuthenticated,
			isLoading,
			login,
			register,
			logout,
		}),
		[user, isAuthenticated, isLoading, login, register, logout],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}

export { ApiClientError };
