import { loadAdminSettings } from "@/lib/adminSettings";
import { HomeForm } from "./HomeForm";

export default async function HomeAdminPage() {
  const { home, options } = await loadAdminSettings();
  return (
    <div className="max-w-3xl">
      <h1 className="mb-1">Trang chủ</h1>
      <p className="mb-6 text-sm text-ink-500">Banner chỉ hiện trên máy tính (từ 768px). 6 lựa chọn hiện ở mọi thiết bị.</p>
      <HomeForm initialHome={home} initialOptions={options} />
    </div>
  );
}
