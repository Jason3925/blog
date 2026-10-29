import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useNavigate, useParams } from "react-router-dom";
import { collectLocalFileIds, localFileRef } from "@my-blog/shared";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { api, type Post } from "../lib/api";
import { composeEditorDoc, newArticleTemplate, parseEditorDoc, slugForDoc } from "../lib/doc";
import { remarkPreview, syncPreviewScroll } from "../lib/previewSync";

interface LocalFile {
  file: File;
  preview: string;
}

function previewUrlTransform(url: string): string {
  if (url.startsWith("local-file:") || url.startsWith("blob:") || url.startsWith("/api/files/")) {
    return url;
  }
  return defaultUrlTransform(url);
}

function formatPreviewDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function resolveLocalUrl(url: string, localFiles: Map<string, LocalFile>): string {
  const localId = /^local-file:(.+)$/.exec(url)?.[1];
  if (!localId) return url;
  return localFiles.get(localId)?.preview ?? url;
}

function createFileId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function EditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const [markdown, setMarkdown] = useState("");
  const [draft, setDraft] = useState(true);
  const [existingSlug, setExistingSlug] = useState<string>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [localFiles, setLocalFiles] = useState<Map<string, LocalFile>>(() => new Map());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const localFilesRef = useRef(localFiles);
  const previewRef = useRef<HTMLDivElement>(null);
  const caretOffset = useRef<number | null>(null);
  const [caretGen, setCaretGen] = useState(0);
  localFilesRef.current = localFiles;

  useEffect(() => {
    void api.listPosts().then(setPosts).catch(() => undefined);
    if (!id) {
      setMarkdown(newArticleTemplate());
      setDraft(true);
      setExistingSlug(undefined);
      setReady(true);
      return;
    }
    setReady(false);
    void api
      .getPost(id)
      .then((post) => {
        setMarkdown(
          composeEditorDoc({
            title: post.title,
            date: post.date,
            tags: post.tags,
            cover: post.cover,
            content: post.content,
          }),
        );
        setDraft(post.draft);
        setExistingSlug(post.slug);
        setReady(true);
      })
      .catch((err: Error) => setError(err.message));
  }, [id]);

  useEffect(() => {
    return () => {
      for (const item of localFilesRef.current.values()) URL.revokeObjectURL(item.preview);
    };
  }, []);

  const doc = useMemo(() => {
    const parsed = parseEditorDoc(markdown);
    const cover = parsed.cover ? resolveLocalUrl(parsed.cover, localFiles) : undefined;
    return { ...parsed, cover };
  }, [markdown, localFiles]);

  const titles = useMemo(() => new Map(posts.map((post) => [post.slug, post.title])), [posts]);

  function handleCaret(offset: number) {
    caretOffset.current = offset;
    setCaretGen((n) => n + 1);
  }

  useEffect(() => {
    if (caretGen === 0) return;
    const root = previewRef.current;
    const cursor = caretOffset.current;
    if (!root || cursor == null) return;
    const frame = requestAnimationFrame(() => syncPreviewScroll(root, markdown, cursor));
    return () => cancelAnimationFrame(frame);
  }, [caretGen, markdown]);

  function pickLocalFile(file: File): string {
    const fileId = createFileId();
    const previewUrl = URL.createObjectURL(file);
    setLocalFiles((current) => {
      const next = new Map(current);
      next.set(fileId, { file, preview: previewUrl });
      return next;
    });
    return localFileRef(fileId);
  }

  async function flushLocalImages(text: string): Promise<string> {
    const ids = collectLocalFileIds(text);
    let next = text;
    const uploadedIds: string[] = [];
    try {
      for (const fileId of ids) {
        const item = localFiles.get(fileId);
        if (!item) continue;
        const uploaded = await api.upload(item.file);
        next = next.replaceAll(localFileRef(fileId), uploaded.url);
        uploadedIds.push(fileId);
        URL.revokeObjectURL(item.preview);
      }
    } finally {
      if (uploadedIds.length > 0) {
        setMarkdown(next);
        setLocalFiles((current) => {
          const copy = new Map(current);
          for (const fileId of uploadedIds) copy.delete(fileId);
          return copy;
        });
      }
    }
    return next;
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const parsed = parseEditorDoc(markdown);
    if (!parsed.title) {
      setError("请在首行用「# 标题」写文章标题");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const flushed = await flushLocalImages(markdown);
      const finalDoc = parseEditorDoc(flushed);
      const payload = {
        title: finalDoc.title,
        slug: slugForDoc(finalDoc.title, existingSlug),
        date: finalDoc.date,
        tags: finalDoc.tags,
        cover: finalDoc.cover,
        draft,
        content: finalDoc.content,
      };
      if (isNew) await api.createPost(payload);
      else await api.updatePost(id, payload);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex min-h-0 flex-1 flex-col">
      <div ref={previewRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-6">
        {ready ? (
          <article className="pb-8">
            <header className="mb-8">
              <h1 className="text-[clamp(1.625rem,4vw,2.125rem)] font-medium leading-snug tracking-tight">
                {doc.title || "未命名"}
              </h1>
              <p className="mt-3 text-sm text-muted">
                <time dateTime={doc.date}>{formatPreviewDate(doc.date)}</time>
                {draft ? <span> · 草稿</span> : null}
              </p>
              {doc.tags.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {doc.tags.map((tag) => (
                    <li key={tag}>
                      <span className="tag-label">{tag}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </header>
            {doc.cover ? <img src={doc.cover} alt="" className="mb-8 w-full rounded border border-border" /> : null}
            {doc.content.trim() ? (
              <div className="markdown">
                <Markdown
                  remarkPlugins={[
                    remarkGfm,
                    remarkPreview({
                      resolveTitle: (slug) => titles.get(slug),
                      resolveUrl: (url) => resolveLocalUrl(url, localFiles),
                    }),
                  ]}
                  urlTransform={previewUrlTransform}
                  components={{
                    img: ({ node: _node, src, alt, ...props }) => <img {...props} src={src} alt={alt ?? ""} />,
                    a: ({ node: _node, href, children, className, ...props }) => {
                      const external = Boolean(href && /^https?:\/\//i.test(href));
                      const mention = Boolean(href && href.startsWith("/posts/"));
                      return (
                        <a
                          {...props}
                          href={href}
                          className={mention ? "post-mention" : className}
                          {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                          onClick={(event) => {
                            if (!external) event.preventDefault();
                          }}
                        >
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {doc.content}
                </Markdown>
              </div>
            ) : null}
          </article>
        ) : (
          <p className="text-sm text-muted">加载中…</p>
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-bg pt-3 pb-4">
        {error ? <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <div className="mb-2 flex items-center justify-between gap-3">
          <Link to="/" className="text-sm text-muted hover:text-fg">
            ← 文章列表
          </Link>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={draft} onChange={(event) => setDraft(event.target.checked)} />
              草稿
            </label>
            <button
              type="submit"
              disabled={saving || !ready}
              className="rounded-full bg-fg px-4 py-2 text-sm text-bg hover:opacity-80 disabled:opacity-40"
            >
              {saving ? "提交中…" : "提交文章"}
            </button>
          </div>
        </div>
        {ready ? (
          <div className="h-[clamp(15rem,34vh,22rem)]">
            <MarkdownEditor
              value={markdown}
              onChange={setMarkdown}
              onUpload={pickLocalFile}
              onCaret={handleCaret}
              fill
              selectTitleOnFocus={isNew}
            />
          </div>
        ) : null}
      </div>
    </form>
  );
}
