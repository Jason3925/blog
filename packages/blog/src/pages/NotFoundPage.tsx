import { useEffect } from "react";
import { Link } from "react-router-dom";
import { site } from "@config/site";

export function NotFoundPage() {
  useEffect(() => {
    document.title = `未找到 · ${site.title}`;
  }, []);

  return (
    <div className="max-w-prose py-10">
      <h1 className="text-xl font-medium tracking-tight">页面不存在</h1>
      <p className="mt-2 text-sm text-muted">这篇文章可能已删除，或链接写错了。</p>
      <Link to="/" className="link-quiet mt-6 inline-block text-sm">
        返回首页
      </Link>
    </div>
  );
}
