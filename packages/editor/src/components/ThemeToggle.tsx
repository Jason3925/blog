import { useTheme } from "../lib/theme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "切换为浅色主题" : "切换为深色主题"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-fg transition-opacity hover:opacity-70"
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="4" />
          <path
            strokeLinecap="round"
            d="M12 3v1.5M12 19.5V21M4.5 12H3M21 12h-1.5M6.2 6.2l-1-1M18.8 18.8l-1-1M6.2 17.8l-1 1M18.8 5.2l-1 1"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 14.5A7.5 7.5 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5Z"
          />
        </svg>
      )}
    </button>
  );
}
