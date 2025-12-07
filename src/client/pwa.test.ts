/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "../..");

describe("PWA Configuration", () => {
	describe("Web Manifest (via vite.config.ts)", () => {
		it("has required manifest fields in vite config", () => {
			const viteConfig = readFileSync(
				resolve(projectRoot, "vite.config.ts"),
				"utf-8",
			);

			// Verify manifest configuration exists
			expect(viteConfig).toContain('name: "Kioku"');
			expect(viteConfig).toContain('short_name: "Kioku"');
			expect(viteConfig).toContain(
				'description: "A spaced repetition learning app"',
			);
			expect(viteConfig).toContain('theme_color: "#1a535c"');
			expect(viteConfig).toContain('background_color: "#faf9f6"');
			expect(viteConfig).toContain('display: "standalone"');
			expect(viteConfig).toContain('start_url: "/"');
		});

		it("has icon configuration", () => {
			const viteConfig = readFileSync(
				resolve(projectRoot, "vite.config.ts"),
				"utf-8",
			);

			expect(viteConfig).toContain('src: "icon.svg"');
			expect(viteConfig).toContain('type: "image/svg+xml"');
			expect(viteConfig).toContain('purpose: "any maskable"');
		});

		it("has registerType autoUpdate", () => {
			const viteConfig = readFileSync(
				resolve(projectRoot, "vite.config.ts"),
				"utf-8",
			);

			expect(viteConfig).toContain('registerType: "autoUpdate"');
		});
	});

	describe("Workbox Configuration", () => {
		it("has workbox caching patterns configured", () => {
			const viteConfig = readFileSync(
				resolve(projectRoot, "vite.config.ts"),
				"utf-8",
			);

			expect(viteConfig).toContain("globPatterns:");
			expect(viteConfig).toContain("runtimeCaching:");
		});

		it("has navigate fallback for offline support", () => {
			const viteConfig = readFileSync(
				resolve(projectRoot, "vite.config.ts"),
				"utf-8",
			);

			expect(viteConfig).toContain('navigateFallback: "/offline.html"');
		});

		it("excludes API routes from navigate fallback", () => {
			const viteConfig = readFileSync(
				resolve(projectRoot, "vite.config.ts"),
				"utf-8",
			);

			expect(viteConfig).toContain("navigateFallbackDenylist:");
			expect(viteConfig).toContain("/^\\/api\\//");
		});

		it("has image caching configuration", () => {
			const viteConfig = readFileSync(
				resolve(projectRoot, "vite.config.ts"),
				"utf-8",
			);

			expect(viteConfig).toContain('handler: "CacheFirst"');
			expect(viteConfig).toContain('cacheName: "images-cache"');
		});
	});

	describe("Offline Fallback Page", () => {
		const offlineHtml = readFileSync(
			resolve(projectRoot, "public/offline.html"),
			"utf-8",
		);

		it("exists and is valid HTML", () => {
			expect(offlineHtml).toContain("<!doctype html>");
			expect(offlineHtml).toContain("<html");
			expect(offlineHtml).toContain("</html>");
		});

		it("has proper meta tags", () => {
			expect(offlineHtml).toContain('charset="UTF-8"');
			expect(offlineHtml).toContain('name="viewport"');
			expect(offlineHtml).toContain('name="theme-color"');
			expect(offlineHtml).toContain('content="#4CAF50"');
		});

		it("has appropriate title", () => {
			expect(offlineHtml).toContain("<title>Kioku - Offline</title>");
		});

		it("displays offline message", () => {
			expect(offlineHtml).toContain("You're Offline");
			expect(offlineHtml).toContain("lost your internet connection");
		});

		it("has retry button", () => {
			expect(offlineHtml).toContain("<button");
			expect(offlineHtml).toContain("Try Again");
			expect(offlineHtml).toContain("window.location.reload()");
		});

		it("has Kioku icon", () => {
			expect(offlineHtml).toContain("<svg");
			expect(offlineHtml).toContain('fill="#4CAF50"');
		});
	});

	describe("Icon", () => {
		const iconSvg = readFileSync(
			resolve(projectRoot, "public/icon.svg"),
			"utf-8",
		);

		it("exists and is valid SVG", () => {
			expect(iconSvg).toContain("<svg");
			expect(iconSvg).toContain("</svg>");
			expect(iconSvg).toContain('xmlns="http://www.w3.org/2000/svg"');
		});

		it("has proper viewBox for square icon", () => {
			expect(iconSvg).toContain('viewBox="0 0 512 512"');
		});

		it("uses theme color", () => {
			expect(iconSvg).toContain('fill="#4CAF50"');
		});

		it("contains K letter for Kioku branding", () => {
			expect(iconSvg).toContain(">K<");
		});
	});
});
