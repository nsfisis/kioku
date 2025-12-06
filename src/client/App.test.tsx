/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { App } from "./App";

function renderWithRouter(path: string) {
	const { hook } = memoryLocation({ path, static: true });
	return render(
		<Router hook={hook}>
			<App />
		</Router>,
	);
}

afterEach(() => {
	cleanup();
});

describe("App routing", () => {
	it("renders home page at /", () => {
		renderWithRouter("/");
		expect(screen.getByRole("heading", { name: "Kioku" })).toBeDefined();
		expect(screen.getByText("Spaced repetition learning app")).toBeDefined();
	});

	it("renders login page at /login", () => {
		renderWithRouter("/login");
		expect(screen.getByRole("heading", { name: "Login" })).toBeDefined();
	});

	it("renders register page at /register", () => {
		renderWithRouter("/register");
		expect(screen.getByRole("heading", { name: "Register" })).toBeDefined();
	});

	it("renders 404 page for unknown routes", () => {
		renderWithRouter("/unknown-route");
		expect(
			screen.getByRole("heading", { name: "404 - Not Found" }),
		).toBeDefined();
		expect(screen.getByRole("link", { name: "Go to Home" })).toBeDefined();
	});
});
