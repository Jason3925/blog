import { Link } from "react-router-dom";
import { formatDate } from "../lib/date";
import type { Post } from "../lib/posts";
import { TagList } from "./TagList";

export function PostCard({ post }: { post: Post }) {
  const hasMeta = post.meta.draft || post.meta.tags.length > 0;

  return (
    <article className="py-4">
      <h2 className="text-lg font-medium tracking-tight">
        <Link to={`/posts/${post.slug}`} className="link-plain">
          {post.meta.title}
        </Link>
      </h2>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        <time dateTime={post.meta.date}>{formatDate(post.meta.date)}</time>
        {hasMeta ? (
          <>
            {post.meta.draft ? <span>草稿</span> : null}
            <TagList tags={post.meta.tags} inline />
          </>
        ) : null}
      </div>
    </article>
  );
}
