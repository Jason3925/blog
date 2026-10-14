# MyBlog 架构设计（ARCHITECTURE）

> 本文档阐述一期与二期的整体架构、分层、数据流，以及一期为二期预留的解耦点。

---

## 1. 总体目标

- **一期**：单体静态博客（`packages/blog`），内容以 `.md` 文件驱动，构建时自动生成目录与页面。
- **二期**：演进为三端——`blog`（预览）、`editor`（编辑）、`server`（后端）。后端负责内容存储、标签管理、阿里云 OSS 图片托管；编辑端补齐标签联想（`#`）与文章引用（`@`）。

---

## 2. 一期架构

### 2.1 分层

```
┌─────────────────────────────────────────┐
│              展示层（pages/components）  │  HomePage / PostPage / 404 / TOC ...
├─────────────────────────────────────────┤
│              内容层（lib/posts.ts）      │  glob 扫描 → 解析 → 校验 → 排序
├─────────────────────────────────────────┤
│              契约层（packages/shared）    │  Frontmatter 类型 + zod schema
├─────────────────────────────────────────┤
│              数据层（content/*.md）       │  纯 MD 文件，与代码解耦
└─────────────────────────────────────────┘
```

### 2.2 核心数据流（「写 MD 自动生成目录」的实现）

```
content/posts/*.md
        │
        │ Vite 插件扫描 content/posts/*.md
        ▼
gray-matter 解析 frontmatter + 正文
        │
        ▼
zod 校验（packages/shared）
        │
        ├─ 非法 / draft:true → 过滤
        ▼
按 date 倒序排序 → 生成 slug
        │
        ▼
[ { slug, meta, content } ] → 路由渲染（首页列表 / 详情 / 404）
```

### 2.3 关键设计决策

| 决策                            | 理由                                                |
| ------------------------------- | --------------------------------------------------- |
| `content/` 与代码分离           | 二期 editor 静态化只需写合法 md 到此，blog 端零改动 |
| 内容层 / 渲染层解耦             | 二期切换 server API 数据源时，只替换 `lib/posts.ts` |
| 契约上移 `packages/shared`      | editor 生成 md 复用同一 schema，保证兼容            |
| 构建期扫描而非运行时读盘        | 生产包不含草稿原文；dev 下文件变更可热更新           |

---

## 3. 目录结构

```
my-blog2/
├── pnpm-workspace.yaml
├── package.json
├── config/site.ts            # 站点配置（一期/二期共用）
├── content/
│   ├── posts/*.md            # 内容源
│   └── images/               # 一期本地图片
├── packages/
│   ├── shared/               # 契约层
│   ├── blog/                 # 一期应用
│   ├── editor/               # 二期预留
│   └── server/               # 二期预留
└── docs/
```

---

## 4. 二期架构（预留设计）

### 4.1 三端职责

```
        ┌────────────┐   静态化产物 / 内容    ┌────────────┐
        │   editor   │ ──────────────────────▶│    blog    │
        │  (编辑端)  │                        │  (预览端)  │
        └─────┬──────┘                        └────────────┘
              │ API 调用
              ▼
        ┌────────────┐
        │   server   │   图片上传 / CDN 转链 / 内容存储 / 扩展
        │  (后端)    │
        └────────────┘
```

| 端                 | 职责                                         |
| ------------------ | -------------------------------------------- |
| `blog`（预览端）   | 展示静态内容，一期即本仓库的 blog 应用       |
| `editor`（编辑端） | 内容编辑、`#` 标签联想、`@` 文章引用、图片上传、内容管理、静态化命令 |
| `server`（后端）   | 内容存储、标签表、图片上传 OSS、预览用签名/CDN URL、后续扩展         |

### 4.2 静态化链路

```
editor 编辑内容
      │
      ├─ 文本 / 元数据 → 组装为合法 frontmatter + 正文
      ├─ 图片 → 编辑时本地预览；**提交文章时**才上传 OSS
      ├─ 标签 → 提交时才写入标签表（`#` 联想不提前建标签）
      ├─ 正文 `@` → 落盘为 `@[slug]`
      ▼
静态化命令：
      ├─ 下载图片 → 写入 blog 的 content/images/
      ├─ md 内远程图片 URL 改写为本地相对路径
      ▼
生成合法 .md → 写入 content/
      ▼
blog 端 build（图片已是本地文件，无需转链）
      ▼
产出纯静态资源（自包含，永不过期）
```

> **图片策略**：编辑时与标签一样延迟提交——先本地预览，保存文章才上传 OSS。静态化时再把图片**下载到本地 `content/images/`** 并改写为相对路径。blog 产物完全自包含，不受签名时效或域名变动影响。

### 4.3 标签

- 后端独立 **标签表**（至少：`id`、`name`、创建时间），文章与标签多对多。
- 编辑器输入 `#` 时，请求已有标签列表做联想；选中已有标签，或继续输入后视为「将创建的新标签」。
- **新标签只在文章提交时入库**。输入过程中不写库，避免产生未使用标签。
- 提交时：已存在的标签只建关联；名称尚不存在的才 insert。对使用者无感知。
- 静态化写入 frontmatter `tags: [...]`，与一期契约兼容。

### 4.4 文章引用

- 编辑器输入 `@` 时，联想已有文章（标题 / slug），选中后插入引用。
- 落盘语法：`@[slug]`（例如 `@[hello-world]`）。
- blog 渲染为指向 `/posts/:slug` 的链接，展示文案用该文**当前标题**（改标题后引用处自动跟上）。
- 目标文章不存在时降级为普通文本，不打断整篇渲染。
- 不另建引用表；解析时按 slug 查文章即可（若后续要做「被引用列表」再加表）。

### 4.5 阿里云 OSS / CDN

- 编辑时图片先插在正文里本地预览；**提交文章时**才上传 OSS（未保存的图不会进 Bucket）。
- 对象 key 带环境前缀：`dev/...` 或 `prod/...`，来自 `BUCKET_URL` 的路径。
- 密钥与 Bucket 信息放仓库根目录 `.env`，**不入库**。模板见 `.env.example`。
- 当前约定变量：

| 变量 | 说明 |
| ---- | ---- |
| `OSS_ACCESS_KEY_ID` | AccessKey ID |
| `OSS_ACCESS_KEY_SECRET` | AccessKey Secret |
| `BUCKET_URL` | Bucket 域名，可带环境前缀：`bucket.oss-cn-hangzhou.aliyuncs.com/dev`（生产改 `/prod`） |
| `OSS_PREFIX` | 可选；不写则从 `BUCKET_URL` 路径解析，缺省 `dev` |
| `OSS_REGION` / `OSS_BUCKET` / `CDN_DOMAIN` | 可选；项目就绪后按需补到 `.env` |

SDK 用法见文末附录。

### 4.6 一期预留解耦点

| 预留点    | 一期铺垫                   | 二期动作                                      |
| --------- | -------------------------- | --------------------------------------------- |
| 内容契约  | `packages/shared` schema   | editor 生成 md 复用                           |
| 内容落点  | `content/` 独立            | editor 写合法 md 到此                         |
| 图片约定  | `content/images/` 相对引用 | 编辑预览用 OSS/CDN URL；静态化下载落盘 + 改写引用 |
| 站点配置  | `config/site.ts` 独立      | editor 静态化复用                                 |
| workspace | `packages/*` 结构          | 新增 editor / server                              |
| 数据源    | 内容层与渲染层分离         | 切换 server API                                   |
| 标签      | frontmatter `tags`         | 标签表 + 提交时同步                               |
| 引用      | 普通链接                   | `@[slug]` + `@` 联想                              |
| 对象存储  | 无                         | 阿里云 OSS，凭证来自 `.env`                       |

---

## 5. 技术栈

| 用途   | 选型                                      |
| ------ | ----------------------------------------- |
| 构建   | Vite + `@vitejs/plugin-react`             |
| UI     | React 19                                  |
| 样式   | TailwindCSS v4（`@tailwindcss/vite`）     |
| 路由   | react-router-dom                          |
| MD     | gray-matter + react-markdown + remark-gfm |
| 高亮   | rehype-highlight                          |
| 契约   | zod（`packages/shared`）                  |
| 后端   | Hono + SQLite（better-sqlite3）           |
| 对象存储 | 阿里云 OSS（`ali-oss`）                 |
| 包管理 | pnpm workspace                            |

---

## 6. 二期技术演进

| 方向     | 一期                         | 二期                                      |
| -------- | ---------------------------- | ----------------------------------------- |
| 数据源   | 构建期扫描本地 md            | editor 生成 md 后静态化 / 可选 server API |
| 图片     | 本地相对路径                 | OSS 上传 + 预览用签名/CDN URL；静态化再落盘 |
| 内容存储 | git 仓库                     | server 持久化（DB / 对象存储）              |
| 标签     | 写在 md 里                   | 标签表；`#` 联想；提交才入库                |
| 引用     | 手写 Markdown 链接           | `@` 联想已有文章，落盘 `@[slug]`            |
| 权限     | 无                           | server 鉴权，editor 登录                    |
| 预览     | dev 本地预览                 | 静态化预览 / 运行时预览                     |

---

## 7. 边界与取舍

1. **一期不引入后端**：所有能力在构建期完成，保证零运维、纯静态可部署。
2. **契约先行**：`packages/shared` 是一期/二期兼容的关键，schema 需保持向后兼容扩展（新增字段用可选）。
3. **图片相对引用是核心约定**：二期转链依赖此约定，早期写作者必须遵守（见 CONTENT_FORMAT.md）。
4. **内容与代码强隔离**：任何编辑器产物、自动化写入都应落入 `content/`，避免污染应用代码。
5. **主题系统**：黑白主题通过 CSS 变量（`:root` / `.dark`）+ 根元素切换 `.dark` class 实现，选择持久化于 `localStorage`，首次跟随系统偏好（`prefers-color-scheme`）。二期无需改动，可直接复用同一套变量契约。
6. **密钥不进仓库**：OSS 凭证只存在 `.env`；文档与示例只用变量名。
7. **标签延迟写入**：联想可以读全量表，创建必须等到文章提交，避免脏数据。

---

## 8. 附录：阿里云 OSS 参考代码

二期 `packages/server` 使用 `ali-oss`。`region` / `bucket` 可从 `BUCKET_URL` 解析，或由后续补进 `.env` 的字段提供。

```js
const OSS = require("ali-oss");

const client = new OSS({
  // Bucket 所在地域，例如杭州：oss-cn-hangzhou
  region: "yourregion",
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  authorizationV4: true,
  bucket: "yourBucketName",
});
```

上传（编辑端预览前把文件写入 Bucket）：

```js
const path = require("path");

const headers = {
  "x-oss-storage-class": "Standard",
  "x-oss-object-acl": "private",
  "x-oss-forbid-overwrite": "true",
};

async function put() {
  const result = await client.put(
    "exampleobject.txt",
    path.normalize("D:\\localpath\\examplefile.txt"),
    { headers },
  );
  console.log(result);
}
```

列举 Bucket（联调用）：

```js
async function listBuckets() {
  const result = await client.listBuckets();
  console.log(result);
}
```

静态化下载图片时，用签名 URL 或 `GET /files/:id` 经 server 转发，再写入 `content/images/`。
