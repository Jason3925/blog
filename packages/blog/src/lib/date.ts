export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${year}年${Number(month)}月${Number(day)}日`;
}
