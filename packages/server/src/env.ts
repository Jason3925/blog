import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_DIR = path.resolve(here, "..");
export const REPO_ROOT = path.resolve(SERVER_DIR, "../..");

dotenv.config({ path: path.join(REPO_ROOT, ".env") });

function parseBucketUrl(
  raw: string | undefined,
): { bucket: string; region: string; prefix: string } | null {
  if (!raw) return null;
  const withoutProtocol = raw.replace(/^https?:\/\//, "");
  const slash = withoutProtocol.indexOf("/");
  const host = (slash >= 0 ? withoutProtocol.slice(0, slash) : withoutProtocol).trim();
  const prefix = (slash >= 0 ? withoutProtocol.slice(slash + 1) : "").replace(/^\/+|\/+$/g, "");
  const match = /^([^.]+)\.(oss-[a-z0-9-]+)\.aliyuncs\.com$/i.exec(host);
  if (!match) return null;
  return { bucket: match[1], region: match[2], prefix };
}

const parsed = parseBucketUrl(process.env.BUCKET_URL);

export const env = {
  port: Number(process.env.PORT ?? 8787),
  ossAccessKeyId: process.env.OSS_ACCESS_KEY_ID ?? "",
  ossAccessKeySecret: process.env.OSS_ACCESS_KEY_SECRET ?? "",
  bucketUrl: process.env.BUCKET_URL ?? "",
  ossRegion: process.env.OSS_REGION || parsed?.region || "",
  ossBucket: process.env.OSS_BUCKET || parsed?.bucket || "",
  ossPrefix: process.env.OSS_PREFIX || parsed?.prefix || "dev",
  cdnDomain: process.env.CDN_DOMAIN ?? "",
  editorUser: process.env.EDITOR_USER ?? "",
  editorPassword: process.env.EDITOR_PASSWORD ?? "",
  blogDist: process.env.BLOG_DIST ?? "",
};

export function editorAuthEnabled(): boolean {
  return Boolean(env.editorUser && env.editorPassword);
}

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(SERVER_DIR, "data");

export const paths = {
  dataDir,
  dbFile: path.join(dataDir, "blog.db"),
  postsDir: path.join(REPO_ROOT, "content", "posts"),
  imagesDir: path.join(REPO_ROOT, "content", "images"),
};

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}
