import { Link, useMatch } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { ThemeProvider } from "../lib/theme";
import { ThemeToggle } from "./ThemeToggle";

export function Layout({ children }: { children: ReactNode }) {
  const { status, authRequired, logout } = useAuth();
  const editing = Boolean(useMatch("/new") || useMatch("/posts/:id"));

  return (
    <ThemeProvider>
      <div className={`flex flex-col bg-bg text-fg ${editing ? "h-dvh overflow-hidden" : "min-h-dvh"}`}>
        <header className="z-10 shrink-0 border-b border-border bg-bg/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
            <Link to="/" className="text-[15px] font-semibold tracking-tight">
              编辑器
            </Link>
            <div className="flex items-center gap-3">
              {status === "ready" && authRequired ? (
                <button type="button" onClick={() => void logout()} className="text-sm text-muted hover:text-fg">
                  退出
                </button>
              ) : null}
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main
          className={
            editing
              ? "mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col overflow-hidden px-5"
              : "mx-auto w-full max-w-5xl flex-1 px-5 py-10"
          }
        >
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
