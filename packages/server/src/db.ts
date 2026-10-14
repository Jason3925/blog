import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import matter from "gray-matter";
import { parseFrontmatter } from "@my-blog/shared";
import { ensureDir, paths } from "./env";

export const db = (() => {
  ensureDir(paths.dataDir);
  const instance = new Database(paths.dbFile);
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  return instance;
})();

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    cover TEXT,
    draft INTEGER NOT NULL DEFAULT 0,
    series TEXT,
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS post_tags (
    post_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (post_id, tag_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    oss_key TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime TEXT,
    created_at TEXT NOT NULL
  );
`);

export interface PostRow {
  id: string;
  slug: string;
  title: string;
  date: string;
  description: string | null;
  cover: string | null;
  draft: number;
  series: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface TagRow {
  id: string;
  name: string;
  created_at: string;
}

export interface FileRow {
  id: string;
  oss_key: string;
  original_name: string;
  mime: string | null;
  created_at: string;
}

export function getPostTags(postId: string): string[] {
  const rows = db
    .prepare(
      `SELECT t.name FROM tags t
       JOIN post_tags pt ON pt.tag_id = t.id
       WHERE pt.post_id = ?
       ORDER BY t.name COLLATE NOCASE`,
    )
    .all(postId) as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

export function toPostDto(row: PostRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    date: row.date,
    description: row.description ?? undefined,
    cover: row.cover ?? undefined,
    draft: Boolean(row.draft),
    series: row.series ?? undefined,
    content: row.content,
    tags: getPostTags(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function seedFromContent() {
  const count = db.prepare("SELECT COUNT(*) AS n FROM posts").get() as { n: number };
  if (count.n > 0 || !fs.existsSync(paths.postsDir)) return;

  const files = fs.readdirSync(paths.postsDir).filter((name) => name.endsWith(".md"));
  const insertPost = db.prepare(`
    INSERT INTO posts (id, slug, title, date, description, cover, draft, series, content, created_at, updated_at)
    VALUES (@id, @slug, @title, @date, @description, @cover, @draft, @series, @content, @created_at, @updated_at)
  `);

  const now = new Date().toISOString();
  for (const name of files) {
    const raw = fs.readFileSync(path.join(paths.postsDir, name), "utf8");
    const parsed = matter(raw);
    const fm = parseFrontmatter(parsed.data);
    if (!fm.success) continue;
    const slug = fm.data.slug ?? name.replace(/\.md$/i, "");
    const id = crypto.randomUUID();
    insertPost.run({
      id,
      slug,
      title: fm.data.title,
      date: fm.data.date,
      description: fm.data.description ?? null,
      cover: fm.data.cover ?? null,
      draft: fm.data.draft ? 1 : 0,
      series: fm.data.series ?? null,
      content: parsed.content.trimStart(),
      created_at: now,
      updated_at: now,
    });
    syncPostTags(id, fm.data.tags);
  }
}

export function syncPostTags(postId: string, names: string[]) {
  const unique = [
    ...new Set(names.map((name) => name.trim()).filter(Boolean)),
  ];
  const now = new Date().toISOString();
  const findTag = db.prepare("SELECT id FROM tags WHERE name = ? COLLATE NOCASE");
  const insertTag = db.prepare("INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)");
  const insertRel = db.prepare("INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)");

  db.prepare("DELETE FROM post_tags WHERE post_id = ?").run(postId);
  for (const name of unique) {
    const existing = findTag.get(name) as { id: string } | undefined;
    const tagId = existing?.id ?? crypto.randomUUID();
    if (!existing) insertTag.run(tagId, name, now);
    insertRel.run(postId, tagId);
  }
}

seedFromContent();
