import { Link } from "react-router-dom";
import { site } from "@config/site";
import { ThemeProvider } from "../lib/theme";
import { ThemeToggle } from "./ThemeToggle";
import type { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <div className="flex min-h-dvh flex-col bg-bg text-fg">
        <header className="sticky top-0 z-10 bg-bg">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
            <Link to="/" className="text-[15px] font-semibold tracking-tight no-underline">
              {site.title}
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">{children}</main>
        <footer className="mx-auto w-full max-w-3xl px-5 pb-10 text-xs text-muted">
          {site.author}
        </footer>
      </div>
    </ThemeProvider>
  );
}
