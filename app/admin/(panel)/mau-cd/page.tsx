import { TemplateAdmin } from "@/components/admin/TemplateAdmin";

export default function Page() {
  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-3xl">Mẫu Custom CD</h1>
      <p className="mb-6 text-sm text-ink-600">
        Mỗi mẫu gồm ảnh khung phía trước (PNG trong suốt) và các ô đặt ảnh. Khách bấm vào ô để thả ảnh của họ — ảnh nằm dưới khung.
      </p>
      <TemplateAdmin mode="cd" />
    </div>
  );
}
