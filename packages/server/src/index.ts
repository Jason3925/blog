import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./env";
import { filesRoute } from "./routes/files";
import { postsRoute } from "./routes/posts";
import { staticizeRoute } from "./routes/staticize";
import { tagsRoute } from "./routes/tags";

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/posts", postsRoute);
app.route("/api/tags", tagsRoute);
app.route("/api/files", filesRoute);
app.route("/api/staticize", staticizeRoute);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || "服务器错误" }, 500);
});

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`server listening on http://localhost:${info.port}`);
});
