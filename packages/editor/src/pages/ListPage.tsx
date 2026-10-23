import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Post } from "../lib/api";

export function ListPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      setPosts(await api.listPosts());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法连接后端，请先 pnpm --filter server dev");
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function staticize() {
    setBusy(true);
    setMessage("");
    try {
      const result = await api.staticize();
      setMessage(
        `已写出 ${result.written.length} 篇到 content/posts/${
          result.skippedDrafts?.length > 0 ? `，跳过 ${result.skippedDrafts.length} 篇草稿` : ""
        }${result.rebuilt ? "，博客已更新" : ""}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "静态化失败");
    } finally {
      setBusy(false);
    }
  }

  async function remove(post: Post) {
    if (!confirm(`删除「${post.title}」？`)) return;
    await api.deletePost(post.id);
    await reload();
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">文章</h1>
          <p className="mt-1 text-sm text-muted">在正文里用 # 标签、@ 引用、/ 插入日期或图片。提交后标签入库。</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void staticize()}
            className="rounded-full border border-border px-4 py-2 text-sm hover:opacity-70 disabled:opacity-40"
          >
            静态化
          </button>
          <Link
            to="/new"
            className="rounded-full bg-fg px-4 py-2 text-sm text-bg hover:opacity-80"
          >
            写新文章
          </Link>
        </div>
      </div>
      {error ? <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-muted">{message}</p> : null}
      {posts.length === 0 && !error ? <p className="text-muted">还没有文章。</p> : null}
      <ul>
        {posts.map((post) => (
          <li key={post.id} className="flex items-baseline justify-between gap-4 border-b border-border py-4">
            <div>
              <Link to={`/posts/${post.id}`} className="font-medium hover:opacity-70">
                {post.title}
              </Link>
              <p className="mt-1 text-sm text-muted">
                {post.date}
                {post.draft ? " · 草稿" : ""}
                {post.tags.length > 0 ? ` · ${post.tags.join(" / ")}` : ""}
              </p>
            </div>
            <button
              type="button"
              className="text-sm text-muted hover:text-fg"
              onClick={() => void remove(post)}
            >
              删除
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
