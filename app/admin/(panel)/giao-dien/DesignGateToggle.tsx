"use client";
/* Giao diện → Thiết kế: "Yêu cầu số điện thoại / mã đơn hàng" — bật thì trang Thiết kế và mọi trang con hiện trang "Yêu cầu nhập mã"
   (cấu hình ở Giao diện → Khác). Lưu site_settings.design_gate. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { Toggle, toast } from "@/components/admin/ui";

export function DesignGateToggle() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => { createClient().from("site_settings").select("value").eq("key", "design_gate").maybeSingle().then(({ data }) => setOn(data?.value === true)); }, []);
  async function set(v: boolean) {
    setOn(v);
    const { error } = await createClient().from("site_settings").upsert({ key: "design_gate", value: v, updated_at: new Date().toISOString() });
    if (error) { setOn(!v); return toast(error.message, "err"); }
    await revalidatePublic(["/thiet-ke"], true);
    toast(v ? "Đã bật — khách cần nhập SĐT / mã đơn hàng để thiết kế" : "Đã tắt yêu cầu nhập mã");
  }
  return (
    <div className="rounded-[12px] border border-[#e5e5e7] bg-white p-4">
      {on !== null && <Toggle checked={on} onChange={set} label="Yêu cầu số điện thoại / mã đơn hàng" />}
      <p className="mt-1.5 text-[12px] text-[#71717a]">Bật: trang Thiết kế và mọi trang con chỉ mở cho khách có <b>đơn web chưa giao</b> (nhập SĐT) hoặc <b>mã đơn Shopee</b> tiệm đã thêm ở <Link href="/admin?tab=shopee" className="text-[#ff5fa2]">Tổng quan → Đơn hàng Shopee</Link> (dùng 7 ngày kể từ lần nhập đầu). Sửa trang yêu cầu ở tab <Link href="/admin/giao-dien?tab=khac" className="text-[#ff5fa2]">Khác</Link>.</p>
    </div>
  );
}
