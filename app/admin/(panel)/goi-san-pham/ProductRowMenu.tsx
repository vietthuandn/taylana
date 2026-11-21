"use client";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { RowMenu } from "@/components/ui/RowMenu";
import { confirmDialog, toast } from "@/components/admin/ui";

const PUBLIC_PATHS = ["/dat-don", "/gio-hang", "/thiet-ke/cd", "/gui-file/cd"];

export function ProductRowMenu({ id, name, slug, active }: { id: string; name: string; slug: string; active: boolean }) {
  const router = useRouter();
  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    const { error } = await fn();
    if (error) return toast(error.message, "err");
    await revalidatePublic(PUBLIC_PATHS);
    toast(ok); router.refresh();
  }
  return <RowMenu items={[
    { label: "Sửa", icon: <Pencil size={14} />, href: `/admin/goi-san-pham/${id}` },
    { label: "Xem trên web", icon: <ExternalLink size={14} />, href: `/san-pham/${slug}` },
    { label: active ? "Ẩn sản phẩm" : "Bật bán", icon: active ? <EyeOff size={14} /> : <Eye size={14} />,
      onClick: () => run(() => createClient().from("products").update({ is_active: !active }).eq("id", id), active ? "Đã ẩn" : "Đã bật bán") },
    { label: "Xoá", icon: <Trash2 size={14} />, danger: true,
      onClick: async () => { if (await confirmDialog(`Xoá sản phẩm "${name}" cùng tất cả nhóm tuỳ chọn? Đơn cũ vẫn giữ thông tin đã đặt.`, { danger: true, ok: "Xoá" })) run(() => createClient().from("products").delete().eq("id", id), "Đã xoá"); } },
  ]} />;
}
