import { TemplateAdmin } from "@/components/admin/TemplateAdmin";

export default function Page() {
  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-3xl">Khung Photostrip</h1>
      <p className="mb-6 text-sm text-ink-600">Khổ 2 x 6 inch (600 x 1800 px). Mỗi khung có 3 hoặc 4 ô ảnh, màu nền và ảnh trang trí phía trước (tuỳ chọn).</p>
      <TemplateAdmin mode="strip" />
    </div>
  );
}
