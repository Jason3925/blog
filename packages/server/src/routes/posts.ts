import { Hono } from "hono";
import { postInputSchema } from "@my-blog/shared";
import { db, syncPostTags, toPostDto, type PostRow } from "../db";

export const postsRoute = new Hono();

postsRoute.get("/", (c) => {
  const rows = db
    .prepare("SELECT * FROM posts ORDER BY date DESC, slug ASC")
    .all() as PostRow[];
  return c.json(rows.map(toPostDto));
});

postsRoute.get("/mentions", (c) => {
  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  const rows = db
    .prepare("SELECT id, slug, title, draft FROM posts ORDER BY date DESC")
    .all() as Array<{ id: string; slug: string; title: string; draft: number }>;
  const items = rows
    .filter((row) => {
      if (!q) return true;
      return row.title.toLowerCase().includes(q) || row.slug.toLowerCase().includes(q);
    })
    .slice(0, 20)
    .map((row) => ({ id: row.id, slug: row.slug, title: row.title, draft: Boolean(row.draft) }));
  return c.json(items);
});

postsRoute.get("/:id", (c) => {
  const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(c.req.param("id")) as
    | PostRow
    | undefined;
  if (!row) return c.json({ error: "文章不存在" }, 404);
  return c.json(toPostDto(row));
});

postsRoute.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = postInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }

  const data = parsed.data;
  const exists = db.prepare("SELECT id FROM posts WHERE slug = ?").get(data.slug) as
    | { id: string }
    | undefined;
  if (exists) return c.json({ error: `slug「${data.slug}」已存在` }, 409);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO posts (id, slug, title, date, description, cover, draft, series, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.slug,
    data.title,
    data.date,
    data.description ?? null,
    data.cover ?? null,
    data.draft ? 1 : 0,
    data.series ?? null,
    data.content,
    now,
    now,
  );
  syncPostTags(id, data.tags);

  const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as PostRow;
  return c.json(toPostDto(row), 201);
});

postsRoute.put("/:id", async (c) => {
  const id = c.req.param("id");
  const current = db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as PostRow | undefined;
  if (!current) return c.json({ error: "文章不存在" }, 404);

  const body = await c.req.json();
  const parsed = postInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  }

  const data = parsed.data;
  const clash = db
    .prepare("SELECT id FROM posts WHERE slug = ? AND id != ?")
    .get(data.slug, id) as { id: string } | undefined;
  if (clash) return c.json({ error: `slug「${data.slug}」已存在` }, 409);

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE posts SET slug=?, title=?, date=?, description=?, cover=?, draft=?, series=?, content=?, updated_at=?
     WHERE id=?`,
  ).run(
    data.slug,
    data.title,
    data.date,
    data.description ?? null,
    data.cover ?? null,
    data.draft ? 1 : 0,
    data.series ?? null,
    data.content,
    now,
    id,
  );
  syncPostTags(id, data.tags);

  const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as PostRow;
  return c.json(toPostDto(row));
});

postsRoute.delete("/:id", (c) => {
  const id = c.req.param("id");
  const current = db.prepare("SELECT id FROM posts WHERE id = ?").get(id) as { id: string } | undefined;
  if (!current) return c.json({ error: "文章不存在" }, 404);
  db.prepare("DELETE FROM posts WHERE id = ?").run(id);
  return c.json({ ok: true });
});
