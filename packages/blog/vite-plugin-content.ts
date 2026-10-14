import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { parseFrontmatter, type Frontmatter } from "@my-blog/shared";
import type { Plugin, ViteDevServer } from "vite";

const VIRTUAL_ID = "virtual:posts";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

const IMAGE_MIME: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export interface SerializedPost {
  slug: string;
  meta: Frontmatter;
  content: string;
  filepath: string;
}

function withBase(base: string, pathname: string): string {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${pathname.replace(/^\//, "")}`;
}

function toPublicImageUrl(src: string, base: string): string | undefined {
  const normalized = src.replaceAll("\\", "/");
  const match = /(?:\.\.\/)*images\/(.+)$/.exec(normalized);
  if (!match) return undefined;
  return withBase(base, `images/${match[1]}`);
}

function rewriteMarkdownImages(markdown: string, base: string): string {
  return markdown.replace(
    /(!\[[^\]]*]\()([^)]+)(\))/g,
    (full, open: string, src: string, close: string) => {
      const next = toPublicImageUrl(src, base);
      return next ? `${open}${next}${close}` : full;
    },
  );
}

function excerptFrom(content: string): string {
  const text = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export function loadPostsFromDisk(
  postsDir: string,
  includeDrafts: boolean,
  base: string,
): SerializedPost[] {
  if (!fs.existsSync(postsDir)) return [];

  const bySlug = new Map<string, SerializedPost>();
  const files = fs
    .readdirSync(postsDir)
    .filter((name) => name.endsWith(".md"))
    .sort();

  for (const name of files) {
    const abs = path.join(postsDir, name);
    const raw = fs.readFileSync(abs, "utf8");
    const { data, content } = matter(raw);
    const parsed = parseFrontmatter(data);

    if (!parsed.success) {
      console.error(`[posts] 无效 frontmatter，已跳过：${name} — ${parsed.error}`);
      continue;
    }

    for (const warning of parsed.warnings) {
      console.warn(`[posts] ${name}: ${warning}`);
    }

    const meta = parsed.data;
    if (meta.draft && !includeDrafts) continue;
    if (!meta.description) {
      meta.description = excerptFrom(content) || undefined;
    }
    if (meta.cover) {
      meta.cover = toPublicImageUrl(meta.cover, base) ?? meta.cover;
    }

    const filepath = `content/posts/${name}`;
    const slug = meta.slug ?? path.basename(name, ".md");
    if (bySlug.has(slug)) {
      console.warn(`[posts] 重复 slug「${slug}」，后者覆盖前者：${filepath}`);
    }

    bySlug.set(slug, {
      slug,
      meta,
      content: rewriteMarkdownImages(content, base),
      filepath,
    });
  }

  return [...bySlug.values()].sort((a, b) => {
    if (a.meta.date === b.meta.date) return a.slug.localeCompare(b.slug);
    return a.meta.date < b.meta.date ? 1 : -1;
  });
}

function serveContentImages(imagesDir: string, base: string) {
  return (server: ViteDevServer) => {
    server.middlewares.use((req, res, next) => {
      const rawUrl = req.url?.split("?")[0] ?? "";
      let pathname = decodeURIComponent(rawUrl);
      const basePrefix = base.endsWith("/") ? base.slice(0, -1) : base;
      if (basePrefix && pathname.startsWith(basePrefix)) {
        pathname = pathname.slice(basePrefix.length) || "/";
      }
      if (!pathname.startsWith("/images/")) {
        next();
        return;
      }

      const rel = pathname.slice("/images/".length);
      const abs = path.resolve(imagesDir, rel);
      if (!abs.startsWith(path.resolve(imagesDir)) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        next();
        return;
      }

      const ext = path.extname(abs).toLowerCase();
      res.setHeader("Content-Type", IMAGE_MIME[ext] ?? "application/octet-stream");
      fs.createReadStream(abs).pipe(res);
    });
  };
}

export function contentPostsPlugin(rootDir: string, base: string): Plugin {
  const postsDir = path.join(rootDir, "content/posts");
  const imagesDir = path.join(rootDir, "content/images");
  const contentDir = path.join(rootDir, "content");
  let command: "build" | "serve" = "serve";

  return {
    name: "content-posts",
    configResolved(config) {
      command = config.command;
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      const includeDrafts = command === "serve";
      const posts = loadPostsFromDisk(postsDir, includeDrafts, base);
      return `export const posts = ${JSON.stringify(posts)};`;
    },
    configureServer(server) {
      server.watcher.add(contentDir);
      serveContentImages(imagesDir, base)(server);

      const reload = (file: string) => {
        if (!file.replaceAll("\\", "/").includes("/content/")) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
          server.ws.send({ type: "full-reload" });
        }
      };

      server.watcher.on("add", reload);
      server.watcher.on("unlink", reload);
      server.watcher.on("change", reload);
    },
    writeBundle(outputOptions) {
      if (!fs.existsSync(imagesDir)) return;
      const outDir = outputOptions.dir;
      if (!outDir) return;
      fs.cpSync(imagesDir, path.join(outDir, "images"), { recursive: true });
    },
  };
}
