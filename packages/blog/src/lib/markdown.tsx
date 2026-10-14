import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import type { ReactNode } from "react";
import { replaceMentions } from "@my-blog/shared";
import { resolveImageSrc } from "./images";
import { posts } from "./posts";

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fff-]/g, "");
}

function nodeToText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (node && typeof node === "object" && "props" in node) {
    const element = node as { props?: { children?: ReactNode } };
    return nodeToText(element.props?.children);
  }
  return "";
}

export function extractToc(markdown: string): TocItem[] {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, "");
  const items: TocItem[] = [];
  for (const line of withoutCode.split("\n")) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line);
    if (!match) continue;
    const level = match[1].length as 2 | 3;
    const text = match[2].replace(/[#*`]/g, "").trim();
    items.push({ id: slugify(text), text, level });
  }
  return items;
}

export function MarkdownView({ content }: { content: string }) {
  const rendered = replaceMentions(content, (slug) => posts.find((post) => post.slug === slug)?.meta.title);
  const components: Components = {
    img: ({ src, alt }) => (
      <img src={resolveImageSrc(src)} alt={alt ?? ""} loading="lazy" />
    ),
    h2: ({ children }) => {
      const text = nodeToText(children);
      return <h2 id={slugify(text)}>{children}</h2>;
    },
    h3: ({ children }) => {
      const text = nodeToText(children);
      return <h3 id={slugify(text)}>{children}</h3>;
    },
    a: ({ href, children }) => {
      const external = Boolean(href && /^https?:\/\//i.test(href));
      const mention = Boolean(href && /^\/posts\//.test(href));
      return (
        <a
          href={href}
          className={mention ? "post-mention" : undefined}
          {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
        >
          {children}
        </a>
      );
    },
  };

  return (
    <div className="markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {rendered}
      </Markdown>
    </div>
  );
}
