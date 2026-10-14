import { formatDate } from "../lib/date";
import { extractToc, MarkdownView } from "../lib/markdown";
import { resolveImageSrc } from "../lib/images";
import type { Post } from "../lib/posts";
import { BackButton } from "./BackButton";
import { TagList } from "./TagList";
import { TOC } from "./TOC";

export function PostDetail({ post }: { post: Post }) {
  const toc = extractToc(post.content);
  const cover = post.meta.cover ? resolveImageSrc(post.meta.cover) : undefined;

  return (
    <div>
      <BackButton />
      <header className="mt-6 mb-8">
        <h1 className="max-w-prose text-[clamp(1.625rem,4vw,2.125rem)] font-medium leading-snug tracking-tight">
          {post.meta.title}
        </h1>
        <p className="mt-3 text-sm text-muted">
          <time dateTime={post.meta.date}>{formatDate(post.meta.date)}</time>
          {post.meta.draft ? <span> · 草稿</span> : null}
        </p>
        <TagList tags={post.meta.tags} />
      </header>

      {cover ? <img src={cover} alt="" className="mb-8 w-full" /> : null}

      <div className={toc.length > 0 ? "lg:grid lg:grid-cols-[minmax(0,1fr)_10rem] lg:gap-12" : ""}>
        <article>
          <MarkdownView content={post.content} />
        </article>
        {toc.length > 0 ? (
          <aside className="mt-10 lg:mt-0">
            <div className="lg:sticky lg:top-6">
              <TOC items={toc} />
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
