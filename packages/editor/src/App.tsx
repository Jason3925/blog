import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { EditPage } from "./pages/EditPage";
import { ListPage } from "./pages/ListPage";

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ListPage />} />
          <Route path="/new" element={<EditPage />} />
          <Route path="/posts/:id" element={<EditPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
