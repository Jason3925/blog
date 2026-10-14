import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { site } from "@config/site";
import { PostDetail } from "../components/PostDetail";
import { getPostBySlug } from "../lib/posts";
import { NotFoundPage } from "./NotFoundPage";

export function PostPage() {
  const { slug } = useParams();
  const post = slug ? getPostBySlug(slug) : undefined;

  useEffect(() => {
    document.title = post ? `${post.meta.title} · ${site.title}` : `未找到 · ${site.title}`;
  }, [post]);

  if (!post) return <NotFoundPage />;
  return <PostDetail post={post} />;
}
