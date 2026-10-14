import { Hono } from "hono";
import { fileRefPath } from "@my-blog/shared";
import { env } from "../env";
import { db, type FileRow } from "../db";
import { getOssClient, ossConfigured } from "../oss";

export const filesRoute = new Hono();

filesRoute.post("/", async (c) => {
  if (!ossConfigured()) {
    return c.json({ error: "未配置 OSS，请检查根目录 .env" }, 503);
  }

  const body = await c.req.parseBody({ all: true });
  const file = body.file;
  if (!file || typeof file === "string" || !("arrayBuffer" in file)) {
    return c.json({ error: "请以字段名 file 上传图片" }, 400);
  }

  const uploaded = file as File;
  const buffer = Buffer.from(await uploaded.arrayBuffer());
  const id = crypto.randomUUID();
  const ext = extFromName(uploaded.name || "", uploaded.type);
  const prefix = env.ossPrefix.replace(/^\/+|\/+$/g, "");
  const ossKey = prefix ? `${prefix}/${id}${ext}` : `${id}${ext}`;
  const client = getOssClient()!;

  await client.put(ossKey, buffer, {
    headers: {
      "x-oss-storage-class": "Standard",
      "x-oss-object-acl": "private",
    },
  });

  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO files (id, oss_key, original_name, mime, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(id, ossKey, uploaded.name || `image${ext}`, uploaded.type || null, now);

  return c.json(
    {
      id,
      url: fileRefPath(id),
      name: uploaded.name,
    },
    201,
  );
});

filesRoute.get("/:id", async (c) => {
  const row = db.prepare("SELECT * FROM files WHERE id = ?").get(c.req.param("id")) as
    | FileRow
    | undefined;
  if (!row) return c.json({ error: "文件不存在" }, 404);

  const client = getOssClient();
  if (!client) return c.json({ error: "未配置 OSS" }, 503);

  try {
    const result = await client.get(row.oss_key);
    const data = result.content as Buffer;
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": row.mime || "application/octet-stream",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return c.json({ error: "读取 OSS 对象失败" }, 502);
  }
});

function extFromName(name: string, mime: string): string {
  const fromName = name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : "";
  if (fromName && fromName.length <= 8) return fromName;
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "image/svg+xml") return ".svg";
  return ".bin";
}
