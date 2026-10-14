# MyBlog 实施步骤文档（PLAN）

> 本文档是个人博客项目的**总实施步骤**，覆盖一期（已落地）与二期（编辑端 / 后端）。
> 配套文档：[`CONTENT_FORMAT.md`](./CONTENT_FORMAT.md)（内容规范）、[`ARCHITECTURE.md`](./ARCHITECTURE.md)（架构设计）。

---

## 0. 项目定位

### 0.1 一期目标（本次交付）

构建一个**纯静态、极简风**的个人博客：

- 内容以 `.md` 文件编写，放于 `content/posts/`
- 写完 MD 后，站点**自动生成目录**（构建/开发时扫描 → 首页列表 + 路由）
- MD 顶部用 **Frontmatter** 定义标题、标签、日期等元数据
- 极简 UI：主页 = 文章标题列表；详情页 = 返回 + 正文
- 技术栈：**Vite + React + TailwindCSS + pnpm workspace**

### 0.2 二期目标

三端架构 + 编辑体验补强。细节见 [`ARCHITECTURE.md`](./ARCHITECTURE.md) 第 4 节。

| 端                 | 职责                                                     |
| ------------------ | -------------------------------------------------------- |
| `blog`（预览端）   | 展示静态内容（一期即本仓库）；渲染文章引用               |
| `editor`（编辑端） | 内容编辑、图片上传、标签联想、文章引用、内容管理、静态化 |
| `server`（后端）   | 内容存储、标签表、图片上传到阿里云 OSS、预览转链         |

**二期功能点（已确认）**

1. **编辑 / 管理**：写文章、改元数据、文章列表与草稿、静态化写出 `content/`。
2. **图片**：编辑时上传 OSS，用短期 URL 预览；静态化时下载落盘并改成相对路径。凭证放根目录 `.env`（见 `.env.example`）。
3. **标签**：输入 `#` 联想已有标签；全新标签对用户无感知即可创建；**仅在文章提交时入库**，避免垃圾标签。后端单独一张标签表。
4. **文章引用**：输入 `@` 联想并插入已有文章链接，静态站点可跳转到对应详情。

---

## 1. 技术选型（推荐默认值，可按需调整）

| 用途     | 选型                                      | 备注                               |
| -------- | ----------------------------------------- | ---------------------------------- |
| 构建工具 | Vite + `@vitejs/plugin-react`             | HMR 支持 content 目录热更新        |
| UI 框架  | React 19                                  |                                    |
| 样式     | TailwindCSS v4                            | `@tailwindcss/vite` 插件，零配置   |
| 路由     | react-router-dom                          |                                    |
| MD 解析  | gray-matter + react-markdown + remark-gfm | Frontmatter 提取 + 正文渲染        |
| 代码高亮 | rehype-highlight                          | 浅色主题，匹配极简风               |
| 契约校验 | zod                                       | 放 `packages/shared`，一期二期共用 |
| 包管理   | pnpm workspace                            |                                    |

> **可调整项**：代码高亮是否启用、正文 TOC 是否启用、Tailwind 用 v4 还是 v3、部署 base 路径、暗色主题是否开启——均不影响整体骨架，按需决策即可。

> **已落地**：黑白主题切换已实现（顶部按钮切换，`localStorage` 持久化，跟随系统偏好）。

---

## 2. Workspace 结构

```
my-blog2/
├── pnpm-workspace.yaml              # workspace 声明（含 packages/*）
├── package.json                     # 根脚本：dev / build / lint
├── .gitignore
├── .npmrc                           # 配置 pnpm（如 shamefully-hoist 等）
├── tsconfig.base.json               # TS 基座（shared + blog 继承）
├── README.md
├── config/
│   └── site.ts                      # 站点配置（标题/作者/描述/域名/base）
├── content/                         # ★ 内容层，与代码解耦（二期 editor 落点）
│   ├── posts/
│   │   ├── hello-world.md           # 示例文章
│   │   └── ...
│   └── images/                      # 一期本地图片（二期由 server 转链）
├── packages/
│   ├── shared/                      # 共享契约：Frontmatter 类型 + zod schema
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts             # 导出 schema / 类型 / 校验函数
│   └── blog/                        # 一期应用
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx              # 路由挂载
│           ├── index.css            # Tailwind + 极简主题变量
│           ├── lib/
│           │   ├── posts.ts         # glob 扫描 + gray-matter + zod 校验 + 排序
│           │   ├── markdown.ts      # react-markdown 渲染管线
│           │   └── date.ts          # 日期格式化
│           ├── components/
│           │   ├── Layout.tsx
│           │   ├── PostList.tsx
│           │   ├── PostCard.tsx
│           │   ├── PostDetail.tsx
│           │   ├── TOC.tsx
│           │   └── BackButton.tsx
│           └── pages/
│               ├── HomePage.tsx
│               ├── PostPage.tsx
│               └── NotFoundPage.tsx
└── docs/                            # ★ 本文档与其他配套文档
    ├── PLAN.md                      # 本文件
    ├── CONTENT_FORMAT.md            # 内容规范
    └── ARCHITECTURE.md              # 架构设计
```

---

## 3. 实施里程碑

### M0 — 初始化 workspace

- [x] 创建 `pnpm-workspace.yaml`，声明 `packages/*`
- [x] 创建根 `package.json`（scripts：`dev`、`build`、`lint`；devDeps：typescript 等）
- [x] 创建 `.gitignore`（node_modules / dist / .DS_Store 等）、`.npmrc`
- [x] 创建 `tsconfig.base.json` 基座

**验收**：`pnpm install` 成功；`pnpm -r exec tsc --noEmit` 可跑通（空骨架）。

### M1 — blog 应用骨架

- [x] 初始化 `packages/blog`：Vite + React + Tailwind v4 + react-router-dom
- [x] 配置 `vite.config.ts`（`@vitejs/plugin-react` + `@tailwindcss/vite` + alias）
- [x] 建立 `src/main.tsx`、`App.tsx`（路由）、`index.css`
- [x] 跑通 hello world

**验收**：`pnpm --filter blog dev` 能打开页面。

### M2 — packages/shared 契约

- [x] 定义 `Frontmatter` TS 类型
- [x] 用 zod 定义 `frontmatterSchema`
- [x] 导出 `parseFrontmatter` 校验函数
- [x] 配置 `blog` 依赖 `@my-blog/shared`（workspace 引用）

**验收**：shared 可被 blog import；非法 frontmatter 能报明确错误。

### M3 — 内容层（核心：自动生成目录）

- [x] `content/posts/*.md` 由 Vite 插件构建期扫描（dev 含草稿，build 排除）
- [x] gray-matter 解析 frontmatter 与正文
- [x] zod 校验 → 过滤 `draft: true` 与非法文章
- [x] 按 `date` 倒序排序
- [x] 生成 `slug`（`frontmatter.slug` 优先，缺省取文件名）
- [x] dev 模式新文件可热更新

**验收**：`content/posts` 下新增/删除 md，首页列表实时变化。

### M4 — 页面层

- [x] `HomePage`：站点标题 + 简介 + 文章列表（标题/日期/标签）
- [x] `PostPage`：`BackButton` + 标题/日期/标签 + 正文
- [x] `TOC`（可选）：正文标题大纲
- [x] `NotFoundPage`：极简 404

**验收**：列表点击跳详情、详情可返回、未知路径进 404。

### M5 — MD 渲染增强

- [x] remark-gfm（表格/删除线/任务列表）
- [x] rehype-highlight（代码高亮，浅色主题）
- [x] 图片相对路径处理
- [x] 排版样式（标题层级、段落、引用、代码块、链接）

**验收**：示例 md 中的表格、代码、图片均正常渲染。

### M6 — 极简主题打磨

- [x] CSS 变量定义主题（颜色/字体/间距）
- [x] 黑白主题切换（顶部按钮 + 本地持久化 + 跟随系统偏好）
- [x] 响应式布局（移动端适配）
- [x] 统一间距、排版节奏

**验收**：桌面 + 移动端观感一致且干净；黑白主题切换即时生效且刷新后保持。

### M7 — 示例内容验证

- [x] 写 2~3 篇示例 md（覆盖：普通文章、含 tag、含图片、`draft: true`）

**验收**：draft 文章构建时被排除；其余正常展示。

### M8 — 文档落地

- [x] 完善 `PLAN.md`、`CONTENT_FORMAT.md`、`ARCHITECTURE.md`
- [x] 编写 `README.md`（本地启动 + 发文章指南）

**验收**：新作者仅凭文档即可发布文章。

### M9 — server 骨架与数据

- [x] 初始化 `packages/server`（Hono + SQLite）
- [x] 文章表、标签表、文章-标签关联、文件表
- [x] 首次启动从 `content/posts` 导入已有 md
- [x] 标签搜索接口只读；新标签仅在保存文章时入库

**验收**：`pnpm --filter server dev` 可启动；`GET /api/tags` 返回已有标签。

### M10 — 图片 OSS 与静态化

- [x] 上传图片到阿里云 OSS（凭证来自根目录 `.env`）
- [x] `GET /api/files/:id` 供编辑预览
- [x] `POST /api/staticize` 下载图片到 `content/images/`，写出合法 md

**验收**：编辑端上传后正文出现 `/api/files/:id`；静态化后变为 `../images/...`。

### M11 — editor 应用

- [x] 初始化 `packages/editor`（Vite + React + Tailwind，代理 `/api`）
- [x] 文章列表 / 新建 / 编辑 / 删除
- [x] `#` 标签联想（提交才入库）
- [x] `@` 文章引用，插入 `@[slug]`
- [x] 图片上传与粘贴；静态化按钮

**验收**：`pnpm dev:cms` 可写文章、打标签、引用、静态化。

### M12 — blog 渲染引用

- [x] `@[slug]` 渲染为指向详情页的链接（用当前标题）
- [x] 目标不存在时降级为纯文本

**验收**：示例文中的 `@[hello-world]` 可点击跳转。

---

## 4. 二期落地衔接（预留，本期不实现）

| 预留点         | 一期已做的铺垫                    | 二期动作                                                              |
| -------------- | --------------------------------- | --------------------------------------------------------------------- |
| 内容契约       | `packages/shared` 统一 schema     | editor 生成 md 复用同一契约                                           |
| 内容落点       | `content/` 与代码解耦             | editor 静态化命令写合法 md 到此                                       |
| 图片约定       | 图片放 `content/images/` 相对引用 | CDN 仅供编辑预览；静态化时下载落盘 + 改写相对路径（自包含，永不过期） |
| 站点配置       | `config/site.ts` 独立             | editor 静态化复用                                                     |
| workspace 留位 | `packages/*` 结构                 | 新增 `packages/editor`、`packages/server`                             |
| 数据源解耦     | blog 内容层与渲染层分离           | 二期切换为 server API 运行时预览                                      |
| 标签           | frontmatter `tags` 字符串数组     | 后端标签表 + `#` 联想；提交时才写入新标签                             |
| 文章引用       | 普通 Markdown 链接                | 编辑器 `@` 联想；落盘为 `@[slug]`，blog 渲染成详情链接                |
| 对象存储       | 本地 `content/images/`            | 阿里云 OSS 上传；`.env` 注入密钥，参考代码见 ARCHITECTURE 附录        |

---

## 5. 验收标准（一期完成定义）

1. `pnpm install && pnpm build` 成功产出静态资源
2. 新写一篇 md → 首页自动出现该文章
3. Frontmatter 定义标题/标签/日期正确显示
4. 详情页可正常返回，未知路径进 404
5. 代码高亮、GFM、图片正常渲染
6. 移动端与桌面端观感一致
