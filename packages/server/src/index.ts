import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { editorAuth, login, logout } from "./auth";
import { editorAuthEnabled, env } from "./env";
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
    allowHeaders: ["Content-Type"],
  }),
);
app.use("/api/*", editorAuth);

app.get("/api/health", (c) => c.json({ ok: true, auth: editorAuthEnabled() }));
app.post("/api/login", login);
app.post("/api/logout", logout);
app.get("/api/session", (c) => c.json({ ok: true }));
app.route("/api/posts", postsRoute);
app.route("/api/tags", tagsRoute);
app.route("/api/files", filesRoute);
app.route("/api/staticize", staticizeRoute);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || "服务器错误" }, 500);
});

serve({ fetch: app.fetch, hostname: "0.0.0.0", port: env.port }, (info) => {
  console.log(`server listening on http://localhost:${info.port}`);
  if (editorAuthEnabled()) console.log("editor auth enabled");
  else console.warn("EDITOR_USER / EDITOR_PASSWORD 未设置，编辑 API 未鉴权");
});
