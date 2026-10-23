import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { env, REPO_ROOT } from "./env";

const STAGING = "/tmp/blog-next";

let tail: Promise<void> = Promise.resolve();

export function rebuildBlog(): Promise<boolean> {
  if (!env.blogDist) return Promise.resolve(false);
  const run = tail.then(runBuild, runBuild);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run.then(() => true);
}

function runBuild(): Promise<void> {
  fs.rmSync(STAGING, { recursive: true, force: true });
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["--filter", "blog", "build"], {
      cwd: REPO_ROOT,
      env: { ...process.env, BLOG_DIST: STAGING },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        console.error(output);
        const lines = output.trim().split("\n").slice(-12).join("\n");
        reject(new Error(lines || `博客构建失败（退出码 ${code}）`));
        return;
      }
      if (output.trim()) console.log(output.trim());
      publish(env.blogDist);
      resolve();
    });
  });
}

function publish(dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  copyExceptIndex(STAGING, dest);
  const index = path.join(STAGING, "index.html");
  if (fs.existsSync(index)) fs.copyFileSync(index, path.join(dest, "index.html"));
  removeStale(dest, STAGING);
}

function copyExceptIndex(from: string, to: string) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === "index.html") continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      copyExceptIndex(src, dst);
    } else {
      fs.copyFileSync(src, dst);
    }
  }
}

function removeStale(dest: string, staging: string) {
  for (const entry of fs.readdirSync(dest, { withFileTypes: true })) {
    const dst = path.join(dest, entry.name);
    const src = path.join(staging, entry.name);
    if (!fs.existsSync(src)) {
      fs.rmSync(dst, { recursive: true, force: true });
      continue;
    }
    if (entry.isDirectory()) removeStale(dst, src);
  }
}
