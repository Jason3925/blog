import { posts as loadedPosts } from "virtual:posts";
import type { Frontmatter } from "@my-blog/shared";

export interface Post {
  slug: string;
  meta: Frontmatter;
  content: string;
  filepath: string;
}

export const posts: Post[] = loadedPosts;

export function getPostBySlug(slug: string): Post | undefined {
  return posts.find((post) => post.slug === slug);
}
