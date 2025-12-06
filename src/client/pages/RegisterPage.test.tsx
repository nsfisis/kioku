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
import { RegisterPage } from "./RegisterPage";

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

function renderWithProviders(path = "/register") {
	const { hook } = memoryLocation({ path });
	return render(
		<Router hook={hook}>
			<AuthProvider>
				<RegisterPage />
			</AuthProvider>
		</Router>,
	);
}

describe("RegisterPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiClient.getTokens).mockReturnValue(null);
		vi.mocked(apiClient.isAuthenticated).mockReturnValue(false);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("renders register form", async () => {
		renderWithProviders();

		expect(screen.getByRole("heading", { name: "Register" })).toBeDefined();
		expect(screen.getByLabelText("Username")).toBeDefined();
		expect(screen.getByLabelText("Password")).toBeDefined();
		expect(screen.getByLabelText("Confirm Password")).toBeDefined();
		expect(screen.getByRole("button", { name: "Register" })).toBeDefined();
		expect(screen.getByRole("link", { name: "Login" })).toBeDefined();
	});

	it("validates password match", async () => {
		const user = userEvent.setup();
		renderWithProviders();

		await user.type(screen.getByLabelText("Username"), "testuser");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm Password"), "differentpass");
		await user.click(screen.getByRole("button", { name: "Register" }));

		expect(screen.getByRole("alert").textContent).toBe(
			"Passwords do not match",
		);
		expect(apiClient.register).not.toHaveBeenCalled();
	});

	it("validates password length", async () => {
		const user = userEvent.setup();
		renderWithProviders();

		await user.type(screen.getByLabelText("Username"), "testuser");
		await user.type(screen.getByLabelText("Password"), "short");
		await user.type(screen.getByLabelText("Confirm Password"), "short");
		await user.click(screen.getByRole("button", { name: "Register" }));

		expect(screen.getByRole("alert").textContent).toBe(
			"Password must be at least 8 characters",
		);
		expect(apiClient.register).not.toHaveBeenCalled();
	});

	it("submits form and registers successfully", async () => {
		const user = userEvent.setup();
		const mockUser = { id: "user-1", username: "testuser" };
		vi.mocked(apiClient.register).mockResolvedValue({ user: mockUser });
		vi.mocked(apiClient.login).mockResolvedValue({
			accessToken: "access-token",
			refreshToken: "refresh-token",
			user: mockUser,
		});

		renderWithProviders();

		await user.type(screen.getByLabelText("Username"), "testuser");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm Password"), "password123");
		await user.click(screen.getByRole("button", { name: "Register" }));

		await waitFor(() => {
			expect(apiClient.register).toHaveBeenCalledWith(
				"testuser",
				"password123",
			);
		});
		expect(apiClient.login).toHaveBeenCalledWith("testuser", "password123");
	});

	it("displays error on registration failure", async () => {
		const user = userEvent.setup();
		const { ApiClientError } = await import("../api/client");
		vi.mocked(apiClient.register).mockRejectedValue(
			new ApiClientError("Username already taken", 409),
		);

		renderWithProviders();

		await user.type(screen.getByLabelText("Username"), "existinguser");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm Password"), "password123");
		await user.click(screen.getByRole("button", { name: "Register" }));

		await waitFor(() => {
			expect(screen.getByRole("alert").textContent).toBe(
				"Username already taken",
			);
		});
	});

	it("disables form while submitting", async () => {
		const user = userEvent.setup();
		vi.mocked(apiClient.register).mockImplementation(
			() => new Promise(() => {}), // Never resolves
		);

		renderWithProviders();

		await user.type(screen.getByLabelText("Username"), "testuser");
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.type(screen.getByLabelText("Confirm Password"), "password123");
		await user.click(screen.getByRole("button", { name: "Register" }));

		await waitFor(() => {
			const button = screen.getByRole("button", { name: "Registering..." });
			expect(button.hasAttribute("disabled")).toBe(true);
		});
		expect(
			(screen.getByLabelText("Username") as HTMLInputElement).disabled,
		).toBe(true);
		expect(
			(screen.getByLabelText("Password") as HTMLInputElement).disabled,
		).toBe(true);
		expect(
			(screen.getByLabelText("Confirm Password") as HTMLInputElement).disabled,
		).toBe(true);
	});

	it("calls navigate when already authenticated", async () => {
		vi.mocked(apiClient.isAuthenticated).mockReturnValue(true);
		vi.mocked(apiClient.getTokens).mockReturnValue({
			accessToken: "access-token",
			refreshToken: "refresh-token",
		});

		const { hook } = memoryLocation({ path: "/register" });
		const navigateSpy = vi.fn();
		const hookWithSpy: typeof hook = () => {
			const result = hook();
			return [result[0], navigateSpy];
		};

		render(
			<Router hook={hookWithSpy}>
				<AuthProvider>
					<RegisterPage />
				</AuthProvider>
			</Router>,
		);

		await waitFor(() => {
			expect(navigateSpy).toHaveBeenCalledWith("/", { replace: true });
		});
	});
});
