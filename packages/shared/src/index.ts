import { z } from "zod";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const frontmatterSchema = z.object({
  title: z.string().min(1, "title 不能为空"),
  date: z.string().regex(isoDatePattern, "date 必须为 YYYY-MM-DD"),
  tags: z.array(z.string()).default([]),
  description: z.string().optional(),
  slug: z.string().min(1).optional(),
  cover: z.string().optional(),
  draft: z.boolean().default(false),
  series: z.string().optional(),
});

export type Frontmatter = z.infer<typeof frontmatterSchema>;

export const postInputSchema = z.object({
  title: z.string().min(1, "title 不能为空"),
  date: z.string().regex(isoDatePattern, "date 必须为 YYYY-MM-DD"),
  tags: z.array(z.string()).default([]),
  description: z.string().optional(),
  slug: z
    .string()
    .min(1, "slug 不能为空")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug 仅允许小写字母、数字和连字符"),
  cover: z.string().optional(),
  draft: z.boolean().default(false),
  series: z.string().optional(),
  content: z.string().default(""),
});

export type PostInput = z.infer<typeof postInputSchema>;

export type ParseFrontmatterResult =
  | { success: true; data: Frontmatter; warnings: string[] }
  | { success: false; error: string };

function toDateString(value: unknown): unknown {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return value;
}

function toTags(value: unknown, warnings: string[]): string[] {
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    const tags = value.filter((item): item is string => typeof item === "string");
    if (tags.length !== value.length) {
      warnings.push("tags 含有非字符串项，已忽略非法项");
    }
    return tags;
  }
  warnings.push("tags 类型非法，已回退为空数组");
  return [];
}

function toDraft(value: unknown, warnings: string[]): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  warnings.push("draft 类型非法，已回退为 false");
  return false;
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

/**
 * 校验一篇文章的 frontmatter。
 * title / date 非法时失败；可选字段尽量容错并给出 warnings。
 */
export function parseFrontmatter(raw: unknown): ParseFrontmatterResult {
  if (typeof raw !== "object" || raw === null) {
    return { success: false, error: "frontmatter 必须是对象" };
  }

  const warnings: string[] = [];
  const source = raw as Record<string, unknown>;
  const coerced = {
    ...source,
    date: toDateString(source.date),
    tags: toTags(source.tags, warnings),
    draft: toDraft(source.draft, warnings),
  };

  const parsed = frontmatterSchema.safeParse(coerced);
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) };
  }

  return { success: true, data: parsed.data, warnings };
}

export const FILE_REF_RE = /\/api\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
export const LOCAL_FILE_RE = /local-file:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
export const MENTION_RE = /@\[([^\]]+)\]/g;

function codeFenceRanges(markdown: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const fence = /```[\s\S]*?```/g;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(markdown))) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

function inRanges(offset: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => offset >= start && offset < end);
}

export function replaceMentions(
  markdown: string,
  resolveTitle: (slug: string) => string | undefined,
): string {
  const ranges = codeFenceRanges(markdown);
  return markdown.replace(MENTION_RE, (full, slug: string, offset: number) => {
    if (inRanges(offset, ranges)) return full;
    const title = resolveTitle(slug.trim());
    if (!title) return slug.trim();
    return `[${title}](/posts/${slug.trim()})`;
  });
}

export function collectFileIds(text: string): string[] {
  const ids = new Set<string>();
  const re = new RegExp(FILE_REF_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    ids.add(match[1]);
  }
  return [...ids];
}

export function collectLocalFileIds(text: string): string[] {
  const ids = new Set<string>();
  const re = new RegExp(LOCAL_FILE_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    ids.add(match[1]);
  }
  return [...ids];
}

export function localFileRef(id: string): string {
  return `local-file:${id}`;
}

export function fileRefPath(id: string): string {
  return `/api/files/${id}`;
}
