"use client";
/* Trang Đơn hàng: ⋯ cuối mỗi đơn — Xem · Đánh dấu đã giao · Xoá đơn (xoá file của đơn trên kho lưu trữ qua API trước, rồi xoá đơn). */
import { useRouter } from "next/navigation";
import { Check, Eye, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deleteFiles } from "@/lib/storage/client";
import { RowMenu } from "@/components/ui/RowMenu";
import { confirmDialog, toast } from "@/components/admin/ui";

export function OrderRowMenu({ id, code, delivered }: { id: string; code: string; delivered: boolean }) {
  const router = useRouter();
  async function deliver() {
    const { error } = await createClient().from("orders").update({ status: "delivered" }).eq("id", id);
    if (error) return toast(error.message, "err");
    toast(`Đã đánh dấu đơn ${code} đã giao`); router.refresh();
  }
  async function remove() {
    const sb = createClient();
    const { data: files } = await sb.from("order_files").select("storage_path").eq("order_id", id);
    const n = files?.length ?? 0;
    if (!(await confirmDialog(`Xoá hẳn đơn ${code}${n ? ` và ${n} file` : ""}? Không thể hoàn tác.`, { title: "Xoá đơn", ok: "Xoá đơn", danger: true }))) return;
    if (n) {
      try { await deleteFiles({ keys: files!.map((f) => `order-files/${f.storage_path}`) }); }
      catch (e) { return toast(e instanceof Error ? e.message : "Xoá file thất bại", "err"); }
    }
    const { error } = await sb.from("orders").delete().eq("id", id);
    if (error) return toast(error.message, "err");
    toast(`Đã xoá đơn ${code}`); router.refresh();
  }
  return <RowMenu items={[
    { label: "Xem", icon: <Eye size={14} />, href: `/admin/don-hang/${id}` },
    !delivered && { label: "Đánh dấu đã giao", icon: <Check size={14} />, onClick: deliver },
    { label: "Xoá đơn", icon: <Trash2 size={14} />, danger: true, onClick: remove },
  ]} />;
}
