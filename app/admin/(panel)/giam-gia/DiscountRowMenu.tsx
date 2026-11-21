"use client";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { RowMenu } from "@/components/ui/RowMenu";
import { confirmDialog, toast } from "@/components/admin/ui";

export function DiscountRowMenu({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  async function remove() {
    if (!await confirmDialog(`Xoá chương trình "${name}"? Các đơn đã dùng vẫn giữ số tiền đã giảm.`, { danger: true, ok: "Xoá" })) return;
    const { error } = await createClient().from("discounts").delete().eq("id", id);
    if (error) return toast(error.message, "err");
    await revalidatePublic(["/dat-don"]);
    toast("Đã xoá"); router.refresh();
  }
  return <RowMenu items={[
    { label: "Sửa", icon: <Pencil size={14} />, href: `/admin/giam-gia/${id}` },
    { label: "Xoá", icon: <Trash2 size={14} />, danger: true, onClick: remove },
  ]} />;
}
