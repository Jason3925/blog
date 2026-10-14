import { Link } from "react-router-dom";

export function BackButton() {
  return (
    <Link to="/" className="link-quiet inline-flex items-center gap-1 text-sm">
      <span aria-hidden>←</span>
      返回文章列表
    </Link>
  );
}
