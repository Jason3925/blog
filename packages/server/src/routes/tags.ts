import { Hono } from "hono";
import { db } from "../db";

export const tagsRoute = new Hono();

tagsRoute.get("/", (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (!q) {
    const rows = db
      .prepare("SELECT id, name FROM tags ORDER BY name COLLATE NOCASE")
      .all() as Array<{ id: string; name: string }>;
    return c.json(rows);
  }

  const rows = db
    .prepare(
      `SELECT id, name FROM tags
       WHERE name LIKE ? COLLATE NOCASE
       ORDER BY name COLLATE NOCASE
       LIMIT 20`,
    )
    .all(`%${q}%`) as Array<{ id: string; name: string }>;
  return c.json(rows);
});
