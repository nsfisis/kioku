import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { ApiClientError, apiClient, type User } from "../api/client";

export interface AuthState {
	user: User | null;
	isAuthenticated: boolean;
	isLoading: boolean;
}

export interface AuthActions {
	login: (username: string, password: string) => Promise<void>;
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
	const [isAuthenticated, setIsAuthenticated] = useState(
		apiClient.isAuthenticated(),
	);

	const logout = useCallback(() => {
		apiClient.logout();
		setUser(null);
		setIsAuthenticated(false);
	}, []);

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

	// Subscribe to session expired events from the API client
	useEffect(() => {
		return apiClient.onSessionExpired(() => {
			logout();
		});
	}, [logout]);

	const login = useCallback(async (username: string, password: string) => {
		const response = await apiClient.login(username, password);
		setUser(response.user);
		setIsAuthenticated(true);
	}, []);

	const value = useMemo<AuthContextValue>(
		() => ({
			user,
			isAuthenticated,
			isLoading,
			login,
			logout,
		}),
		[user, isAuthenticated, isLoading, login, logout],
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
