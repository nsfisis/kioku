/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { apiClient } from "../api/client";
import { AuthProvider } from "../stores";
import { LoginPage } from "./LoginPage";

vi.mock("../api/client", () => ({
	apiClient: {
		login: vi.fn(),
		register: vi.fn(),
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

function renderWithProviders(path = "/login") {
	const { hook } = memoryLocation({ path });
	return render(
		<Router hook={hook}>
			<AuthProvider>
				<LoginPage />
			</AuthProvider>
		</Router>,
	);
}

describe("LoginPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiClient.getTokens).mockReturnValue(null);
		vi.mocked(apiClient.isAuthenticated).mockReturnValue(false);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("renders login form", async () => {
		renderWithProviders();

		expect(screen.getByRole("heading", { name: "Login" })).toBeDefined();
		expect(screen.getByLabelText("Username")).toBeDefined();
		expect(screen.getByLabelText("Password")).toBeDefined();
		expect(screen.getByRole("button", { name: "Login" })).toBeDefined();
		expect(screen.getByRole("link", { name: "Register" })).toBeDefined();
	});

	it("submits form and logs in successfully", async () => {
		const user = userEvent.setup();
		const mockUser = { id: "user-1", username: "testuser" };
		vi.mocked(apiClient.login).mockResolvedValue({
			accessToken: "access-token",
			refreshToken: "refresh-token",
			user: mockUser,
		});

		renderWithProviders();

		await user.type(screen.getByLabelText("Username"), "testuser");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.click(screen.getByRole("button", { name: "Login" }));

		await waitFor(() => {
			expect(apiClient.login).toHaveBeenCalledWith("testuser", "password123");
		});
	});

	it("displays error on login failure", async () => {
		const user = userEvent.setup();
		const { ApiClientError } = await import("../api/client");
		vi.mocked(apiClient.login).mockRejectedValue(
			new ApiClientError("Invalid credentials", 401),
		);

		renderWithProviders();

		await user.type(screen.getByLabelText("Username"), "testuser");
		await user.type(screen.getByLabelText("Password"), "wrongpassword");
		await user.click(screen.getByRole("button", { name: "Login" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toBe("Invalid credentials");
		});
	});

	it("displays generic error on unexpected failure", async () => {
		const user = userEvent.setup();
		vi.mocked(apiClient.login).mockRejectedValue(new Error("Network error"));

		renderWithProviders();

		await user.type(screen.getByLabelText("Username"), "testuser");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.click(screen.getByRole("button", { name: "Login" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toBe(
				"Login failed. Please try again.",
			);
		});
	});

	it("disables form while submitting", async () => {
		const user = userEvent.setup();
		vi.mocked(apiClient.login).mockImplementation(
			() => new Promise(() => {}), // Never resolves
		);

		renderWithProviders();

		await user.type(screen.getByLabelText("Username"), "testuser");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.click(screen.getByRole("button", { name: "Login" }));

		await waitFor(() => {
			const button = screen.getByRole("button", { name: "Logging in..." });
			expect(button.hasAttribute("disabled")).toBe(true);
		});
		expect(
			(screen.getByLabelText("Username") as HTMLInputElement).disabled,
		).toBe(true);
		expect(
			(screen.getByLabelText("Password") as HTMLInputElement).disabled,
		).toBe(true);
	});

	it("redirects when already authenticated", async () => {
		vi.mocked(apiClient.isAuthenticated).mockReturnValue(true);
		vi.mocked(apiClient.getTokens).mockReturnValue({
			accessToken: "access-token",
			refreshToken: "refresh-token",
		});

		const { hook } = memoryLocation({ path: "/login" });
		const navigateSpy = vi.fn();
		const hookWithSpy: typeof hook = () => {
			const result = hook();
			return [result[0], navigateSpy];
		};

		render(
			<Router hook={hookWithSpy}>
				<AuthProvider>
					<LoginPage />
				</AuthProvider>
			</Router>,
		);

		await waitFor(() => {
			expect(navigateSpy).toHaveBeenCalledWith("/", { replace: true });
		});
	});
});
