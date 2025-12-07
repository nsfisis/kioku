import * as esbuild from "esbuild";

await esbuild.build({
	entryPoints: [
		"src/server/index.ts",
		"src/server/scripts/add-user.ts",
	],
	bundle: true,
	platform: "node",
	target: "node22",
	format: "esm",
	sourcemap: true,
	outdir: "dist",
	outbase: "src",
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

console.log("Build complete");
