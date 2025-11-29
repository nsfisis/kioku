import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { errorHandler } from "./middleware/error-handler";

const app = new Hono();

app.onError(errorHandler);

app.get("/", (c) => {
	return c.json({ message: "Kioku API" });
});

app.get("/api/health", (c) => {
	return c.json({ status: "ok" });
});

const port = Number(process.env.PORT) || 3000;
console.log(`Server is running on port ${port}`);

serve({
	fetch: app.fetch,
	port,
});

export { app };
