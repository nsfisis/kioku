import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	plugins: [
		tailwindcss(),
		react(),
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: ["icon.svg"],
			manifest: {
				name: "Kioku",
				short_name: "Kioku",
				description: "A spaced repetition learning app",
				theme_color: "#1a535c",
				background_color: "#faf9f6",
				display: "standalone",
				scope: "/",
				start_url: "/",
				icons: [
					{
						src: "icon.svg",
						sizes: "any",
						type: "image/svg+xml",
						purpose: "any maskable",
					},
				],
			},
			workbox: {
				globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/,
						handler: "CacheFirst",
						options: {
							cacheName: "images-cache",
							expiration: {
								maxEntries: 50,
								maxAgeSeconds: 60 * 60 * 24 * 30,
							},
						},
					},
				],
				navigateFallback: "/offline.html",
				navigateFallbackDenylist: [/^\/api\//],
			},
		}),
	],
	root: ".",
	build: {
		outDir: "dist/client",
	},
	server: {
		proxy: {
			"/api": {
				target: "http://localhost:3000",
				changeOrigin: true,
			},
		},
	},
});
