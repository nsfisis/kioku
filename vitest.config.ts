import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify("test"),
	},
	plugins: [react()],
	test: {
		globals: true,
		env: {
			JWT_SECRET: "test-secret-key",
		},
	},
});
