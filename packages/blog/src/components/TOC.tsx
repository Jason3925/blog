import type { TocItem } from "../lib/markdown";

export function TOC({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="文章大纲" className="text-sm">
      <ol className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`block text-muted no-underline transition-opacity hover:opacity-60 ${
                item.level === 3 ? "pl-3" : ""
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
