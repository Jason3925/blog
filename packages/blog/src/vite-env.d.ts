/// <reference types="vite/client" />

declare module "virtual:posts" {
  import type { Frontmatter } from "@my-blog/shared";

  export const posts: {
    slug: string;
    meta: Frontmatter;
    content: string;
    filepath: string;
  }[];
}
