import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import matter from "gray-matter";
import { collectFileIds } from "@my-blog/shared";
import { db, toPostDto, type FileRow, type PostRow } from "../db";
import { ensureDir, paths } from "../env";
import { getOssClient, ossConfigured } from "../oss";

export const staticizeRoute = new Hono();

staticizeRoute.post("/", async (c) => {
  ensureDir(paths.postsDir);
  ensureDir(paths.imagesDir);

  const rows = db.prepare("SELECT * FROM posts ORDER BY date DESC, slug ASC").all() as PostRow[];
  const written: string[] = [];
  const skippedImages: string[] = [];
  const skippedDrafts: string[] = [];

  for (const row of rows) {
    const dto = toPostDto(row);
    const filename = `${dto.slug}.md`;
    const dest = path.join(paths.postsDir, filename);

    if (dto.draft) {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      skippedDrafts.push(filename);
      continue;
    }
    let cover = dto.cover ?? "";
    let content = dto.content;
    const ids = collectFileIds(`${cover}\n${content}`);

    for (const id of ids) {
      const local = await materializeFile(id);
      if (!local) {
        skippedImages.push(id);
        continue;
      }
      const rel = `../images/${local}`;
      content = content.replaceAll(`/api/files/${id}`, rel);
      cover = cover.replaceAll(`/api/files/${id}`, rel);
    }

    const fm: Record<string, unknown> = {
      title: dto.title,
      date: dto.date,
      tags: dto.tags,
      slug: dto.slug,
      draft: dto.draft,
    };
    if (dto.description) fm.description = dto.description;
    if (cover) fm.cover = cover;
    if (dto.series) fm.series = dto.series;

    const markdown = matter.stringify(content.trimStart() || "\n", fm);
    fs.writeFileSync(dest, markdown.endsWith("\n") ? markdown : `${markdown}\n`);
    written.push(filename);
  }

  return c.json({ ok: true, written, skippedImages, skippedDrafts });
});

async function materializeFile(id: string): Promise<string | null> {
  const row = db.prepare("SELECT * FROM files WHERE id = ?").get(id) as FileRow | undefined;
  if (!row) return null;

  const ext = path.extname(row.original_name) || ".bin";
  const filename = `${id.slice(0, 8)}${ext}`;
  const dest = path.join(paths.imagesDir, filename);
  if (fs.existsSync(dest)) return filename;

  const client = getOssClient();
  if (!client || !ossConfigured()) return null;

  try {
    const result = await client.get(row.oss_key);
    fs.writeFileSync(dest, result.content as Buffer);
    return filename;
  } catch {
    return null;
  }
}
