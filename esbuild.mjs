import * as esbuild from "esbuild";

await esbuild.build({
	entryPoints: ["src/server/index.ts"],
	bundle: true,
	platform: "node",
	target: "node22",
	outfile: "dist/server/index.js",
	format: "esm",
	sourcemap: true,
	external: [
		// Node.js built-in modules
		"node:*",
		// Native modules that can't be bundled
		"argon2",
		"pg-native",
	],
	banner: {
		js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
	},
});

console.log("Server build complete: dist/server/index.js");
