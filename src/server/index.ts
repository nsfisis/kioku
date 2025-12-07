import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { errorHandler } from "./middleware/index.js";
import { auth, cards, decks, study } from "./routes/index.js";

const app = new Hono();

app.use("*", logger());
app.onError(errorHandler);

// Chain routes for RPC type inference
const routes = app
	.get("/", (c) => {
		return c.json({ message: "Kioku API" }, 200);
	})
	.get("/api/health", (c) => {
		return c.json({ status: "ok" }, 200);
	})
	.route("/api/auth", auth)
	.route("/api/decks", decks)
	.route("/api/decks/:deckId/cards", cards)
	.route("/api/decks/:deckId/study", study);

export type AppType = typeof routes;

const port = Number(process.env.PORT) || 3000;
console.log(`Server is running on port ${port}`);

serve({
	fetch: app.fetch,
	port,
});

export { app };
