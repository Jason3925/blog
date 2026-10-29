const SEP = /^---\s*$/m;
const MENTION_RE = /@\[([^\]]+)\]/g;

interface Point {
  offset?: number;
}

interface MdNode {
  type: string;
  url?: string;
  value?: string;
  position?: { start: Point; end: Point };
  data?: { hProperties?: Record<string, string> };
  children?: MdNode[];
}

interface PreviewOptions {
  resolveTitle: (slug: string) => string | undefined;
  resolveUrl: (url: string) => string;
}

function stamp(node: MdNode) {
  if (node.type === "root" || node.type === "text" || !node.position) return;
  const start = node.position.start.offset;
  const end = node.position.end.offset;
  if (start == null || end == null) return;
  const data = (node.data ??= {});
  const props = (data.hProperties ??= {});
  props["data-source-start"] = String(start);
  props["data-source-end"] = String(end);
}

function textNode(value: string, offset: number): MdNode {
  return {
    type: "text",
    value,
    position: { start: { offset }, end: { offset: offset + value.length } },
  };
}

function splitMentions(node: MdNode, resolveTitle: PreviewOptions["resolveTitle"]): MdNode[] | null {
  const value = node.value ?? "";
  if (!value.includes("@[")) return null;
  const base = node.position?.start.offset;
  if (base == null) return null;
  MENTION_RE.lastIndex = 0;
  const parts: MdNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let found = false;
  while ((match = MENTION_RE.exec(value))) {
    found = true;
    if (match.index > last) parts.push(textNode(value.slice(last, match.index), base + last));
    const slug = match[1].trim();
    const title = resolveTitle(slug);
    const start = base + match.index;
    const end = start + match[0].length;
    if (title) {
      parts.push({
        type: "link",
        url: `/posts/${slug}`,
        position: { start: { offset: start }, end: { offset: end } },
        children: [textNode(title, start)],
      });
    } else {
      parts.push(textNode(slug, start));
    }
    last = match.index + match[0].length;
  }
  if (!found) return null;
  if (last < value.length) parts.push(textNode(value.slice(last), base + last));
  return parts;
}

function rewrite(node: MdNode, options: PreviewOptions) {
  if (node.type === "image" && node.url) node.url = options.resolveUrl(node.url);
  if (node.children) {
    const next: MdNode[] = [];
    for (const child of node.children) {
      if (child.type === "text") {
        const parts = splitMentions(child, options.resolveTitle);
        if (parts) {
          for (const part of parts) {
            if (part.type !== "text") rewrite(part, options);
            next.push(part);
          }
          continue;
        }
      }
      rewrite(child, options);
      next.push(child);
    }
    node.children = next;
  }
  stamp(node);
}

export function remarkPreview(options: PreviewOptions) {
  return function previewPlugin() {
    return function transform(tree: MdNode) {
      rewrite(tree, options);
    };
  };
}

export function editorBodyOffset(source: string, cursor: number): number | null {
  const match = SEP.exec(source);
  if (!match) return null;
  let bodyStart = match.index + match[0].length;
  if (source[bodyStart] === "\n") bodyStart += 1;
  if (cursor < bodyStart) return null;
  return cursor - bodyStart;
}

export function syncPreviewScroll(root: HTMLElement, source: string, cursor: number) {
  const bodyOffset = editorBodyOffset(source, cursor);
  if (bodyOffset == null) {
    root.scrollTop = 0;
    return;
  }

  const nodes = [...root.querySelectorAll<HTMLElement>("[data-source-start]")];
  let best: HTMLElement | null = null;
  let bestSpan = Infinity;
  for (const el of nodes) {
    const start = Number(el.dataset.sourceStart);
    const end = Number(el.dataset.sourceEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    if (bodyOffset >= start && bodyOffset < end && end - start <= bestSpan) {
      best = el;
      bestSpan = end - start;
    }
  }
  if (!best) {
    let prevEnd = -1;
    for (const el of nodes) {
      const end = Number(el.dataset.sourceEnd);
      if (end <= bodyOffset && end >= prevEnd) {
        best = el;
        prevEnd = end;
      }
    }
  }
  if (!best) return;

  const start = Number(best.dataset.sourceStart);
  const end = Number(best.dataset.sourceEnd);
  const ratio = end > start ? Math.min(1, Math.max(0, (bodyOffset - start) / (end - start))) : 0;
  const rootRect = root.getBoundingClientRect();
  const targetRect = best.getBoundingClientRect();
  const anchor = targetRect.top + targetRect.height * ratio;
  const padding = 48;
  const topLimit = rootRect.top + padding;
  const bottomLimit = rootRect.bottom - padding;
  if (anchor >= topLimit && anchor <= bottomLimit) return;

  const delta = anchor < topLimit ? anchor - topLimit : anchor - bottomLimit;
  const next =
    Math.abs(delta) < 96
      ? root.scrollTop + delta
      : root.scrollTop + (anchor - rootRect.top) - root.clientHeight * 0.28;
  root.scrollTop = Math.max(0, next);
}
