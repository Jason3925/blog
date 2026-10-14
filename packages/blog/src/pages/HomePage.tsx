import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { site } from "@config/site";
import { PostList } from "../components/PostList";
import { posts } from "../lib/posts";

export function HomePage() {
  const [params] = useSearchParams();
  const titleFilter = params.get("title")?.trim() || "";
  const tagFilter = params.get("tag")?.trim() || "";
  const visible = titleFilter
    ? posts.filter((post) => post.meta.title === titleFilter)
    : tagFilter
      ? posts.filter((post) => post.meta.tags.includes(tagFilter))
      : posts;
  const filterLabel = titleFilter || (tagFilter ? `#${tagFilter}` : "");

  useEffect(() => {
    document.title = filterLabel ? `${filterLabel} · ${site.title}` : site.title;
  }, [filterLabel]);

  return (
    <div>
      {!filterLabel ? <p className="mb-8 text-sm text-muted">{site.description}</p> : null}
      {filterLabel ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>
            筛选 <span className="text-fg">{filterLabel}</span>
          </span>
          <Link to="/" className="link-quiet">
            清除
          </Link>
        </div>
      ) : null}
      <PostList
        posts={visible}
        emptyText={filterLabel ? "没有与当前筛选匹配的文章。" : undefined}
      />
    </div>
  );
}
