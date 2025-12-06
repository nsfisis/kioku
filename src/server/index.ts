import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { errorHandler } from "./middleware/index.js";
import { auth } from "./routes/index.js";

const app = new Hono();

app.use("*", logger());
app.onError(errorHandler);

app.get("/", (c) => {
	return c.json({ message: "Kioku API" });
});

app.get("/api/health", (c) => {
	return c.json({ status: "ok" });
});

app.route("/api/auth", auth);

const port = Number(process.env.PORT) || 3000;
console.log(`Server is running on port ${port}`);

serve({
	fetch: app.fetch,
	port,
});

export { app };
