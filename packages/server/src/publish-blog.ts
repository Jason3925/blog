import { rebuildBlog } from "./blog-build";

const rebuilt = await rebuildBlog();
if (!rebuilt) {
  console.log("BLOG_DIST 未设置，跳过博客构建");
}
