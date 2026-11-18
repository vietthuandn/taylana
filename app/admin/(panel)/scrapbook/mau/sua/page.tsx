import { Suspense } from "react";
import { TemplateEditor } from "./TemplateEditor";

// Trình sửa mẫu scrapbook (full màn hình, workspace) — /admin/scrapbook/mau/sua?n=7&style=torn
export default function Page() {
  return <Suspense><TemplateEditor /></Suspense>;
}
