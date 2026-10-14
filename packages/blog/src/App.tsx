import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { site } from "@config/site";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";

const PostPage = lazy(async () => {
  const mod = await import("./pages/PostPage");
  return { default: mod.PostPage };
});

export function App() {
  return (
    <BrowserRouter basename={site.base}>
      <Layout>
        <Suspense fallback={<p className="text-muted">加载中…</p>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/posts/:slug" element={<PostPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}
