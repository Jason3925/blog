import type { ClipboardEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { api, type MentionItem } from "../lib/api";
import { todayIso } from "../lib/slug";
import { DatePopover } from "./DatePopover";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onUpload: (file: File) => string;
  onCaret?: (offset: number) => void;
  fill?: boolean;
  autoFocus?: boolean;
  selectTitleOnFocus?: boolean;
}

type Popup =
  | { kind: "tag"; start: number; q: string }
  | { kind: "mention"; start: number; q: string }
  | { kind: "slash"; start: number; q: string }
  | { kind: "date"; start: number };

const COMMANDS = [
  { id: "date" as const, label: "插入日期", hint: "选择发布日期" },
  { id: "upload" as const, label: "上传图片", hint: "从本地选择文件" },
];

function getCaretPosition(textarea: HTMLTextAreaElement, offset: number): { top: number; left: number } {
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const copy = [
    "boxSizing",
    "width",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "lineHeight",
    "fontFamily",
    "letterSpacing",
    "textAlign",
    "textTransform",
    "wordSpacing",
    "tabSize",
    "whiteSpace",
    "wordWrap",
    "wordBreak",
  ] as const;

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.overflow = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.top = "0";
  mirror.style.left = "0";
  for (const prop of copy) {
    mirror.style[prop] = computed[prop];
  }
  mirror.style.width = `${textarea.clientWidth}px`;

  mirror.textContent = textarea.value.slice(0, offset);
  const marker = document.createElement("span");
  marker.textContent = textarea.value.slice(offset) || ".";
  mirror.append(marker);
  document.body.append(mirror);

  const top = marker.offsetTop - textarea.scrollTop + textarea.offsetTop;
  const left = marker.offsetLeft - textarea.scrollLeft + textarea.offsetLeft;
  mirror.remove();

  const minTop = textarea.offsetTop + 8;
  const maxTop = textarea.offsetTop + textarea.clientHeight - 8;
  return {
    top: Math.min(Math.max(top, minTop), maxTop),
    left: Math.max(8, Math.min(left, textarea.offsetLeft + textarea.clientWidth - 200)),
  };
}

function inCodeFence(value: string, offset: number): boolean {
  return ((value.slice(0, offset).match(/```/g) ?? []).length) % 2 === 1;
}

function detectPopup(value: string, cursor: number): Popup | null {
  if (inCodeFence(value, cursor)) return null;
  const before = value.slice(0, cursor);

  const slash = before.lastIndexOf("/");
  if (slash >= 0) {
    const prev = slash === 0 ? "" : before[slash - 1];
    const fragment = before.slice(slash + 1);
    if ((!prev || /\s/.test(prev)) && !/[\s\n]/.test(fragment)) {
      return { kind: "slash", start: slash, q: fragment };
    }
  }

  const at = before.lastIndexOf("@");
  if (at >= 0) {
    const prev = at === 0 ? "" : before[at - 1];
    const fragment = before.slice(at + 1);
    if (!/[\w\u4e00-\u9fff]/.test(prev) && !fragment.startsWith("[") && !/[\s\n]/.test(fragment)) {
      return { kind: "mention", start: at, q: fragment };
    }
  }

  const hash = before.lastIndexOf("#");
  if (hash >= 0) {
    const prev = hash === 0 ? "" : before[hash - 1];
    const fragment = before.slice(hash + 1);
    const lineStart = before.lastIndexOf("\n") + 1;
    const linePrefix = before.slice(lineStart);
    if (/^#{2,6}$/.test(linePrefix)) return null;
    if (/[\s\n]/.test(fragment)) return null;
    if (prev && /[A-Za-z0-9]/.test(prev)) return null;
    return { kind: "tag", start: hash, q: fragment };
  }

  return null;
}

export function MarkdownEditor({
  value,
  onChange,
  onUpload,
  onCaret,
  fill,
  autoFocus,
  selectTitleOnFocus,
}: Props) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const insertAtRef = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [caret, setCaret] = useState({ top: 0, left: 0 });
  const [active, setActive] = useState(0);
  const [tags, setTags] = useState<Array<{ id: string; name: string }>>([]);
  const [mentions, setMentions] = useState<MentionItem[]>([]);

  useEffect(() => {
    if (!selectTitleOnFocus) return;
    const el = areaRef.current;
    if (!el) return;
    const start = 2;
    const end = start + "标题".length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, end);
    });
  }, [selectTitleOnFocus]);

  useEffect(() => {
    if (popup?.kind !== "tag") return;
    const handle = window.setTimeout(() => {
      void api.tags(popup.q).then(setTags).catch(() => setTags([]));
    }, 80);
    return () => window.clearTimeout(handle);
  }, [popup]);

  useEffect(() => {
    if (popup?.kind !== "mention") return;
    const handle = window.setTimeout(() => {
      void api.mentions(popup.q).then(setMentions).catch(() => setMentions([]));
    }, 80);
    return () => window.clearTimeout(handle);
  }, [popup]);

  function syncPopup(next: string, cursor: number) {
    const found = detectPopup(next, cursor);
    setPopup(found);
    setActive(0);
    const area = areaRef.current;
    if (found && area) setCaret(getCaretPosition(area, found.start));
  }

  function replaceTrigger(from: number, cursor: number, insert: string) {
    const next = `${value.slice(0, from)}${insert}${value.slice(cursor)}`;
    onChange(next);
    setPopup(null);
    requestAnimationFrame(() => {
      const pos = from + insert.length;
      const area = areaRef.current;
      area?.focus();
      area?.setSelectionRange(pos, pos);
      onCaret?.(pos);
    });
  }

  const query = popup && popup.kind !== "date" ? popup.q : "";
  const slashItems = COMMANDS.filter((item) => item.label.includes(query) || item.id.includes(query));
  const tagItems = tags;
  const canCreateTag =
    popup?.kind === "tag" &&
    Boolean(popup.q) &&
    !tagItems.some((item) => item.name.toLowerCase() === popup.q.toLowerCase());
  const mentionItems = mentions;
  const listCount =
    popup?.kind === "slash"
      ? slashItems.length
      : popup?.kind === "tag"
        ? tagItems.length + (canCreateTag ? 1 : 0)
        : popup?.kind === "mention"
          ? mentionItems.length
          : 0;

  function applyActive() {
    if (!popup) return;
    if (popup.kind === "slash") {
      const item = slashItems[active];
      if (item) void runSlash(item.id, popup.start, areaRef.current?.selectionStart ?? value.length);
    }
    if (popup.kind === "mention") {
      const item = mentionItems[active];
      if (item) replaceTrigger(popup.start, areaRef.current?.selectionStart ?? value.length, `@[${item.slug}] `);
    }
    if (popup.kind === "tag") {
      const cursor = areaRef.current?.selectionStart ?? value.length;
      if (active < tagItems.length) {
        replaceTrigger(popup.start, cursor, `#${tagItems[active].name} `);
      } else if (canCreateTag) {
        replaceTrigger(popup.start, cursor, `#${popup.q} `);
      }
    }
  }

  async function runSlash(id: "date" | "upload", from: number, cursor: number) {
    const next = `${value.slice(0, from)}${value.slice(cursor)}`;
    onChange(next);
    insertAtRef.current = from;
    const area = areaRef.current;
    if (area) setCaret(getCaretPosition(area, from));

    if (id === "upload") {
      setPopup(null);
      requestAnimationFrame(() => fileRef.current?.click());
      return;
    }

    setPopup({ kind: "date", start: from });
  }

  function insertAt(snippet: string, at: number) {
    const next = `${value.slice(0, at)}${snippet}${value.slice(at)}`;
    onChange(next);
    requestAnimationFrame(() => {
      const pos = at + snippet.length;
      const area = areaRef.current;
      area?.focus();
      area?.setSelectionRange(pos, pos);
      onCaret?.(pos);
    });
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const file = [...event.clipboardData.files].find((item) => item.type.startsWith("image/"));
    if (!file) return;
    event.preventDefault();
    const url = onUpload(file);
    const cursor = event.currentTarget.selectionStart;
    const prefix = cursor === 0 || value[cursor - 1] === "\n" ? "" : "\n";
    const suffix = value[cursor] === "\n" || cursor === value.length ? "" : "\n";
    insertAt(`${prefix}![${file.name}](${url})${suffix}`, cursor);
  }

  function onFile(file: File, at: number) {
    const url = onUpload(file);
    const prefix = at === 0 || value[at - 1] === "\n" ? "" : "\n";
    insertAt(`${prefix}![${file.name}](${url})\n`, at);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (popup?.kind === "date") {
      event.preventDefault();
      return;
    }
    if (!popup || listCount === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % listCount);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + listCount) % listCount);
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      applyActive();
    }
    if (event.key === "Escape") setPopup(null);
  }

  return (
    <div className={`relative ${fill ? "h-full" : ""}`} ref={wrapRef}>
      <textarea
        ref={areaRef}
        value={value}
        rows={fill ? 6 : 24}
        autoFocus={autoFocus}
        spellCheck={false}
        className={`w-full rounded-lg border border-border bg-bg px-3 py-3 font-mono text-[13px] leading-6 outline-none focus:border-fg ${fill ? "h-full resize-none overflow-y-auto" : "resize-y"}`}
        placeholder={"# 标题\n日期\n#标签\n---\n正文"}
        onScroll={(event) => {
          if (!popup) return;
          setCaret(getCaretPosition(event.currentTarget, popup.start));
        }}
        onChange={(event) => {
          onChange(event.target.value);
          syncPopup(event.target.value, event.target.selectionStart);
          onCaret?.(event.target.selectionStart);
        }}
        onClick={(event) => {
          syncPopup(event.currentTarget.value, event.currentTarget.selectionStart);
          onCaret?.(event.currentTarget.selectionStart);
        }}
        onSelect={(event) => onCaret?.(event.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        onPaste={handlePaste}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file, insertAtRef.current);
        }}
      />

      {popup?.kind === "date" ? (
        <DatePopover
          top={caret.top}
          left={caret.left}
          initial={new Date(`${todayIso()}T00:00:00`)}
          onConfirm={(iso) => {
            insertAt(iso, insertAtRef.current);
            setPopup(null);
          }}
          onCancel={() => {
            setPopup(null);
            areaRef.current?.focus();
          }}
        />
      ) : null}

      {popup?.kind === "slash" && slashItems.length > 0 ? (
        <Menu top={caret.top} left={caret.left}>
          {slashItems.map((item, index) => (
            <MenuItem
              key={item.id}
              active={index === active}
              label={item.label}
              hint={item.hint}
              onPick={() => void runSlash(item.id, popup.start, areaRef.current?.selectionStart ?? value.length)}
            />
          ))}
        </Menu>
      ) : null}

      {popup?.kind === "mention" && mentionItems.length > 0 ? (
        <Menu top={caret.top} left={caret.left}>
          {mentionItems.map((item, index) => (
            <MenuItem
              key={item.id}
              active={index === active}
              label={item.title}
              hint={`@${item.slug}`}
              onPick={() =>
                replaceTrigger(
                  popup.start,
                  areaRef.current?.selectionStart ?? value.length,
                  `@[${item.slug}] `,
                )
              }
            />
          ))}
        </Menu>
      ) : null}

      {popup?.kind === "tag" ? (
        <Menu top={caret.top} left={caret.left}>
          {tagItems.map((item, index) => (
            <MenuItem
              key={item.id}
              active={index === active}
              label={`#${item.name}`}
              onPick={() =>
                replaceTrigger(popup.start, areaRef.current?.selectionStart ?? value.length, `#${item.name} `)
              }
            />
          ))}
          {canCreateTag ? (
            <MenuItem
              active={active === tagItems.length}
              label={`#${popup.q}`}
              hint="提交时入库"
              onPick={() =>
                replaceTrigger(popup.start, areaRef.current?.selectionStart ?? value.length, `#${popup.q} `)
              }
            />
          ) : null}
          {tagItems.length === 0 && !canCreateTag ? (
            <li className="px-3 py-2 text-muted">输入标签名，或空格写成标题</li>
          ) : null}
        </Menu>
      ) : null}
    </div>
  );
}

function Menu({ children, top, left }: { children: ReactNode; top: number; left: number }) {
  const maxLeft = Math.max(8, left);
  return (
    <ul
      className="absolute z-20 max-h-56 min-w-48 max-w-xs overflow-auto rounded-lg border border-border bg-bg py-1 text-sm shadow-md"
      style={{ top, left: maxLeft, transform: "translateY(calc(-100% - 6px))" }}
    >
      {children}
    </ul>
  );
}

function MenuItem({
  label,
  hint,
  active,
  onPick,
}: {
  label: string;
  hint?: string;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`block w-full px-3 py-1.5 text-left hover:bg-code ${active ? "bg-code" : ""}`}
        onMouseDown={(event) => {
          event.preventDefault();
          onPick();
        }}
      >
        <span className="font-medium">{label}</span>
        {hint ? <span className="ml-2 text-xs text-muted">{hint}</span> : null}
      </button>
    </li>
  );
}
