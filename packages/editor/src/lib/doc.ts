import { slugFromTitle, todayIso } from "./slug";

const SEP = /^---\s*$/m;
const ISO_DATE = /\b(\d{4}-\d{2}-\d{2})\b/;
const IMAGE_RE = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export interface EditorDoc {
  title: string;
  date: string;
  tags: string[];
  cover?: string;
  content: string;
}

export function newArticleTemplate(date = todayIso()): string {
  return `# 标题\n\n${date}\n\n#\n\n---\n\n`;
}

export function composeEditorDoc(doc: EditorDoc): string {
  const tagLine = doc.tags.length > 0 ? doc.tags.map((tag) => `#${tag}`).join(" ") : "#";
  const coverLine = doc.cover ? `\n\n![](${doc.cover})` : "";
  return `# ${doc.title || "标题"}\n\n${doc.date}\n\n${tagLine}${coverLine}\n\n---\n\n${doc.content}`;
}

/** 元数据区图片：第一张作封面，其余忽略并从 header 去掉。 */
function takeCoverFromHeader(header: string): { cover?: string; header: string } {
  let cover: string | undefined;
  const cleaned = header
    .replace(IMAGE_RE, (_full, src: string) => {
      if (!cover) cover = src.trim();
      return "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return { cover, header: cleaned };
}

export function parseEditorDoc(raw: string): EditorDoc {
  const match = SEP.exec(raw);
  const rawHeader = match ? raw.slice(0, match.index) : raw;
  const content = match ? raw.slice(match.index + match[0].length).replace(/^\n/, "") : "";
  const { cover, header } = takeCoverFromHeader(rawHeader);

  const titleLine = header.split("\n").find((line) => /^#\s+/.test(line)) ?? "";
  const title = titleLine.replace(/^#\s+/, "").trim();
  const date = ISO_DATE.exec(header)?.[1] ?? todayIso();
  const tags: string[] = [];

  for (const line of header.split("\n")) {
    if (/^#{1,6}\s/.test(line)) continue;
    const tagRe = /(^|\s)#([^\s#]+)/g;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = tagRe.exec(line))) {
      tags.push(tagMatch[2]);
    }
  }

  return { title, date, tags: [...new Set(tags)], cover, content };
}

export function slugForDoc(title: string, existing?: string): string {
  if (existing) return existing;
  return slugFromTitle(title);
}
