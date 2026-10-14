export function resolveImageSrc(src: string | undefined): string {
  if (!src) return "";
  if (/^(https?:|data:|blob:|mailto:)/i.test(src)) return src;
  if (src.startsWith("/") || src.startsWith(import.meta.env.BASE_URL)) return src;

  const match = /(?:\.\.\/)*images\/(.+)$/.exec(src.replaceAll("\\", "/"));
  if (match) return `${import.meta.env.BASE_URL}images/${match[1]}`;
  return src;
}
