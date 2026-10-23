import { createHash, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { editorAuthEnabled, env } from "./env";

const COOKIE = "editor_session";
const MAX_AGE = 60 * 60 * 24 * 30;
const sessions = new Set<string>();

function sameSecret(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

function cookieOptions(c: Context) {
  const forwarded = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  const secure = forwarded ? forwarded === "https" : new URL(c.req.url).protocol === "https:";
  return {
    httpOnly: true,
    sameSite: "Lax" as const,
    path: "/",
    secure,
    maxAge: MAX_AGE,
  };
}

export const editorAuth: MiddlewareHandler = async (c, next) => {
  if (!editorAuthEnabled()) return next();
  if (c.req.method === "OPTIONS") return next();
  const path = c.req.path;
  if (path === "/api/health" || path === "/api/login" || path === "/api/logout") return next();

  const session = await getSignedCookie(c, env.editorPassword, COOKIE);
  if (typeof session !== "string" || !sessions.has(session)) {
    return c.json({ error: "未登录" }, 401);
  }
  return next();
};

export async function login(c: Context) {
  if (!editorAuthEnabled()) return c.json({ ok: true, auth: false });

  const body = await c.req.json().catch(() => null);
  const username = body && typeof body.username === "string" ? body.username : "";
  const password = body && typeof body.password === "string" ? body.password : "";
  if (!sameSecret(username, env.editorUser) || !sameSecret(password, env.editorPassword)) {
    return c.json({ error: "账号或密码错误" }, 401);
  }

  const sessionId = crypto.randomUUID();
  sessions.add(sessionId);
  await setSignedCookie(c, COOKIE, sessionId, env.editorPassword, cookieOptions(c));
  return c.json({ ok: true });
}

export async function logout(c: Context) {
  const session = await getSignedCookie(c, env.editorPassword, COOKIE);
  if (typeof session === "string") sessions.delete(session);
  const { path: cookiePath, secure, sameSite } = cookieOptions(c);
  deleteCookie(c, COOKIE, { path: cookiePath, secure, sameSite });
  return c.json({ ok: true });
}
