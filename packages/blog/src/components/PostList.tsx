import type { Post } from "../lib/posts";
import { PostCard } from "./PostCard";

export function PostList({ posts, emptyText }: { posts: Post[]; emptyText?: string }) {
  if (posts.length === 0) {
    return <p className="text-muted">{emptyText ?? "还没有文章。在 content/posts 下新建一篇 .md 即可。"}</p>;
  }

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.slug} post={post} />
      ))}
    </div>
  );
}
