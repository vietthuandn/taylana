"use client";
/* Quản lý template → CD Template: mẫu mặt đĩa cố định theo danh mục + nút "Chuyển mẫu cũ thành mẫu riêng". */
import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Button, toast } from "@/components/admin/ui";
import { confirmDialog } from "@/components/ui/dialog";
import { revalidatePublic } from "@/app/admin/actions";
import { LibraryAdmin, PUBLIC_PATHS } from "./LibraryAdmin";
import { convertLegacyCd } from "./convert";

export function CdTemplates() {
  const [busy, setBusy] = useState("");
  return (
    <LibraryAdmin kind="cd" extra={(reload) => (
      <Button variant="secondary" icon={<Wand2 size={16} />} loading={!!busy} onClick={async () => {
        if (!(await confirmDialog({ title: "Chuyển mẫu cũ thành mẫu riêng?", message: "Dựng lại 30 mẫu mặt đĩa cũ (5 phong cách × 5–10 ảnh, ưu tiên bản đã sửa) và các mẫu CD tạo mới trước đây, lưu thành mẫu cố định trong danh mục “Cơ bản”. Mẫu đã chuyển trước đó sẽ bỏ qua.", confirmText: "Chuyển ngay" }))) return;
        setBusy("…");
        try {
          const r = await convertLegacyCd((d, t) => setBusy(`${d}/${t}`));
          toast(`Đã chuyển ${r.added} mẫu${r.skipped ? ` · bỏ qua ${r.skipped} mẫu đã có` : ""}`);
          await revalidatePublic(PUBLIC_PATHS); reload();
        } catch (e) { toast(e instanceof Error ? e.message : "Chuyển mẫu thất bại", "err"); }
        setBusy("");
      }}>{busy ? `Đang chuyển ${busy}` : "Chuyển mẫu cũ thành mẫu riêng"}</Button>
    )} />
  );
}
