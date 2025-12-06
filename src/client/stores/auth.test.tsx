/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../api/client";
import { AuthProvider, useAuth } from "./auth";

// Mock the apiClient
vi.mock("../api/client", () => ({
	apiClient: {
		login: vi.fn(),
		logout: vi.fn(),
		isAuthenticated: vi.fn(),
		getTokens: vi.fn(),
	},
	ApiClientError: class ApiClientError extends Error {
		constructor(
			message: string,
			public status: number,
			public code?: string,
		) {
			super(message);
			this.name = "ApiClientError";
		}
	},
}));

const wrapper = ({ children }: { children: ReactNode }) => (
	<AuthProvider>{children}</AuthProvider>
);

describe("useAuth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiClient.getTokens).mockReturnValue(null);
		vi.mocked(apiClient.isAuthenticated).mockReturnValue(false);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("throws error when used outside AuthProvider", () => {
		// Suppress console.error for this test
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		expect(() => {
			renderHook(() => useAuth());
		}).toThrow("useAuth must be used within an AuthProvider");

		consoleSpy.mockRestore();
	});

	it("returns initial unauthenticated state", async () => {
		const { result } = renderHook(() => useAuth(), { wrapper });

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.user).toBeNull();
		expect(result.current.isAuthenticated).toBe(false);
	});

	it("returns authenticated state when tokens exist", async () => {
		vi.mocked(apiClient.getTokens).mockReturnValue({
			accessToken: "test-access-token",
			refreshToken: "test-refresh-token",
		});
		vi.mocked(apiClient.isAuthenticated).mockReturnValue(true);

		const { result } = renderHook(() => useAuth(), { wrapper });

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.isAuthenticated).toBe(true);
	});

	describe("login", () => {
		it("logs in and sets user", async () => {
			const mockUser = { id: "user-1", username: "testuser" };
			vi.mocked(apiClient.login).mockResolvedValue({
				accessToken: "access-token",
				refreshToken: "refresh-token",
				user: mockUser,
			});
			vi.mocked(apiClient.isAuthenticated).mockReturnValue(true);

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false);
			});

			await act(async () => {
				await result.current.login("testuser", "password123");
			});

			expect(apiClient.login).toHaveBeenCalledWith("testuser", "password123");
			expect(result.current.user).toEqual(mockUser);
		});

		it("propagates login errors", async () => {
			vi.mocked(apiClient.login).mockRejectedValue(
				new Error("Invalid credentials"),
			);

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false);
			});

			await expect(
				act(async () => {
					await result.current.login("testuser", "wrongpassword");
				}),
			).rejects.toThrow("Invalid credentials");
		});
	});

	describe("logout", () => {
		it("logs out and clears user", async () => {
			const mockUser = { id: "user-1", username: "testuser" };
			vi.mocked(apiClient.login).mockResolvedValue({
				accessToken: "access-token",
				refreshToken: "refresh-token",
				user: mockUser,
			});
			vi.mocked(apiClient.isAuthenticated).mockReturnValue(true);

			const { result } = renderHook(() => useAuth(), { wrapper });

			await waitFor(() => {
				expect(result.current.isLoading).toBe(false);
			});

			// Login first
			await act(async () => {
				await result.current.login("testuser", "password123");
			});

			expect(result.current.user).toEqual(mockUser);

			// Now logout
			vi.mocked(apiClient.isAuthenticated).mockReturnValue(false);
			act(() => {
				result.current.logout();
			});

			expect(apiClient.logout).toHaveBeenCalled();
			expect(result.current.user).toBeNull();
		});
	});
});
