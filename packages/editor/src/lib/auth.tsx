import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, setUnauthorizedHandler } from "./api";

type Status = "loading" | "login" | "ready";

interface AuthValue {
  status: Status;
  authRequired: boolean;
  notice: string;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [authRequired, setAuthRequired] = useState(false);
  const [notice, setNotice] = useState("");
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (statusRef.current !== "ready") return;
      setNotice("登录已失效，请重新登录");
      setStatus("login");
    });

    let cancelled = false;
    void (async () => {
      try {
        const health = await api.health();
        if (cancelled) return;
        if (!health.auth) {
          setStatus("ready");
          return;
        }
        setAuthRequired(true);
        try {
          await api.session();
          if (!cancelled) setStatus("ready");
        } catch {
          if (!cancelled) setStatus("login");
        }
      } catch {
        if (!cancelled) {
          setNotice("无法连接后端，请先启动 server");
          setStatus("login");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(username: string, password: string) {
    setNotice("");
    await api.login(username, password);
    setAuthRequired(true);
    setStatus("ready");
  }

  async function logout() {
    await api.logout().catch(() => undefined);
    setNotice("");
    setStatus("login");
  }

  return (
    <AuthContext.Provider value={{ status, authRequired, notice, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return value;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.status === "loading") return <p className="text-sm text-muted">加载中…</p>;
  if (auth.status === "login") return <LoginForm />;
  return children;
}

function LoginForm() {
  const { login, notice } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setPending(false);
    }
  }

  const message = error || notice;

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mx-auto max-w-sm space-y-4 pt-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">登录编辑器</h1>
        <p className="mt-1 text-sm text-muted">博客页面仍然公开，这里只保护写文章的接口。</p>
      </div>
      <label className="block text-sm">
        <span className="text-muted">账号</span>
        <input
          required
          autoFocus
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-fg"
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted">密码</span>
        <input
          required
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 outline-none focus:border-fg"
        />
      </label>
      {message ? <p className="text-sm text-red-600 dark:text-red-400">{message}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-fg px-4 py-2 text-sm text-bg hover:opacity-80 disabled:opacity-40"
      >
        {pending ? "登录中…" : "登录"}
      </button>
    </form>
  );
}
