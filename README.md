# My Blog

纯静态、极简风的个人博客。用 Markdown 写文章，构建时自动生成目录与页面。

一期已完成静态博客。二期已落地编辑端 / 后端：标签联想、文章引用、OSS 图片与静态化。

## 本地启动

需要 Node.js 20+ 与 [pnpm](https://pnpm.io)。

```bash
pnpm install
pnpm dev
```

会同时启动三个服务：

- 博客预览：http://localhost:5173
- 编辑器：http://localhost:5174
- 后端：http://localhost:8787

OSS 密钥放仓库根目录 `.env`（参考 `.env.example`）。

```bash
pnpm build     # 产出静态资源到 packages/blog/dist
pnpm preview   # 预览构建结果
pnpm lint      # TypeScript 检查
```

## 如何发布一篇文章

1. 在 `content/posts/` 新建一个 `.md` 文件，例如 `my-new-post.md`。
2. 顶部写 YAML Frontmatter（`title`、`date` 必填）：

```yaml
---
title: 文章标题
date: 2026-08-14
tags: [随笔]
description: 一句话摘要
slug: my-new-post
draft: false
---
```

3. 下面写正文。保存后，开发模式首页会自动出现该文章（Vite 会扫描 `content/posts/`）。
4. 图片请放到 `content/images/`，正文用相对路径引用：

```markdown
![说明](../images/cover.svg)
```

5. `draft: true` 的文章只在 `pnpm dev` 中可见，`pnpm build` 时会被排除。

完整字段与语法说明见 [`docs/CONTENT_FORMAT.md`](./docs/CONTENT_FORMAT.md)。

站点标题、作者、简介在 [`config/site.ts`](./config/site.ts) 修改。

## 用编辑器发布（二期）

1. 配置根目录 `.env`（OSS 密钥）。公网部署时同时填写 `EDITOR_USER` 与 `EDITOR_PASSWORD`，编辑 API 会要求登录；两项都留空则本机不鉴权。博客预览不使用这套接口。
2. `pnpm dev`，打开 http://localhost:5174 。若开了登录，先输入账号密码。
3. 写文章：`#` 选标签（提交时才入库），`@` 引用已有文章。
4. 点「提交文章」保存到后端；点列表页「静态化」写出 `content/posts/`。
5. 博客预览在 http://localhost:5173 。

部署时让编辑器站点和 `/api` 同源（Nginx 把 `/api` 反代到 server）。登录态是 HttpOnly Cookie，图片预览和接口请求都会带上。不要把 server 端口单独暴露到公网。

## 部署

服务器安装 Docker 与 Docker Compose。clone 仓库后，把 `.env.example` 复制为 `.env`，填好 OSS、`EDITOR_USER`、`EDITOR_PASSWORD`，以及两个端口，然后执行：

```bash
./deploy.sh
```

脚本会构建镜像并启动三个容器。对外只有两个端口，写在 `.env` 里：

- `BLOG_PORT`：博客，默认 `8080`
- `EDITOR_PORT`：编辑器，默认 `8081`

后端只在容器网络里，编辑器的 Nginx 把 `/api` 转到它。把域名指到这两个端口即可；证书放在你自己的反代上。反代请带上 `X-Forwarded-Proto`，HTTPS 下登录 Cookie 会标记为 Secure。

数据库在仓库下的 `data/`（含 `blog.db` 和 WAL 文件），文章和图片在 `content/`。这两个目录都挂在容器外面，迁移时一起拷走。

点编辑器里的「静态化」会写出 Markdown，并在 server 容器里重新构建博客。博客容器直接读这份静态文件，页面马上更新，不必重跑部署。改代码、依赖或端口后，再执行一次 `./deploy.sh`。

## 目录结构

```
config/site.ts          站点配置
content/posts/          文章 Markdown
content/images/         本地图片
packages/shared/        Frontmatter 契约（zod）
packages/blog/          预览端
packages/editor/        编辑端
packages/server/        后端（SQLite + OSS）
docs/                   实施 / 内容规范 / 架构
```

## 文档

- [`docs/PLAN.md`](./docs/PLAN.md) — 一期验收与二期功能点
- [`docs/CONTENT_FORMAT.md`](./docs/CONTENT_FORMAT.md) — 写作者内容规范（含 `#` 标签、`@[slug]` 引用）
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — 架构；OSS 变量与参考代码在附录
- [`.env.example`](./.env.example) — 阿里云 OSS 环境变量模板（复制为 `.env`，勿提交密钥）
