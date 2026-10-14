import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useNavigate, useParams } from "react-router-dom";
import { collectLocalFileIds, localFileRef, replaceMentions } from "@my-blog/shared";
import { MarkdownEditor } from "../components/MarkdownEditor";
import { api, type Post } from "../lib/api";
import { composeEditorDoc, newArticleTemplate, parseEditorDoc, slugForDoc } from "../lib/doc";

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

  const preview = useMemo(() => {
    const titles = new Map(posts.map((post) => [post.slug, post.title]));
    const parsed = parseEditorDoc(markdown);
    let body = replaceMentions(parsed.content, (slug) => titles.get(slug));
    for (const fileId of collectLocalFileIds(body)) {
      const url = localFiles.get(fileId)?.preview;
      if (url) body = body.replaceAll(localFileRef(fileId), url);
    }
    return body;
  }, [markdown, posts, localFiles]);

  function pickLocalFile(file: File): string {
    const fileId = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(file);
    setLocalFiles((current) => {
      const next = new Map(current);
      next.set(fileId, { file, preview: previewUrl });
      return next;
    });
    return localFileRef(fileId);
  }

  function resolvePreviewSrc(src: string | undefined): string {
    if (!src) return "";
    const localId = /^local-file:(.+)$/.exec(src)?.[1];
    if (localId) return localFiles.get(localId)?.preview ?? src;
    return src;
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
    <form onSubmit={(event) => void save(event)} className="space-y-5">
      <div className="flex items-center justify-between gap-3">
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

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {ready ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <MarkdownEditor
            value={markdown}
            onChange={setMarkdown}
            onUpload={pickLocalFile}
            selectTitleOnFocus={isNew}
          />
          <div className="markdown rounded-lg border border-border px-4 py-3">
            {preview.trim() ? (
              <Markdown
                remarkPlugins={[remarkGfm]}
                urlTransform={previewUrlTransform}
                components={{
                  img: ({ src, alt }) => <img src={resolvePreviewSrc(src)} alt={alt ?? ""} />,
                }}
              >
                {preview}
              </Markdown>
            ) : (
              <p className="text-muted">预览正文</p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">加载中…</p>
      )}
    </form>
  );
}
