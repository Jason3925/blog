import { Link } from "react-router-dom";

interface Props {
  tags: string[];
  inline?: boolean;
}

export function TagList({ tags, inline = false }: Props) {
  if (tags.length === 0) return null;

  return (
    <ul className={inline ? "inline-flex flex-wrap items-center gap-1" : "mt-2 flex flex-wrap gap-1.5"}>
      {tags.map((tag) => (
        <li key={tag}>
          <Link to={`/?tag=${encodeURIComponent(tag)}`} className="tag-label">
            {tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
