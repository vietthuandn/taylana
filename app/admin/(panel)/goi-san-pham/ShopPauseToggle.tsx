"use client";
/* Sản phẩm của tôi → "Tạm nghỉ bán": bật thì trang Đặt đơn / sản phẩm / giỏ hàng hiện trang "Tạm ngưng nhận đơn qua web"
   (nội dung chỉnh ở Giao diện → Khác). Lưu site_settings.shop_paused. */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { revalidatePublic } from "@/app/admin/actions";
import { toast } from "@/components/admin/ui";
import { cx } from "@/components/admin/styles";

export function ShopPauseToggle() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => { createClient().from("site_settings").select("value").eq("key", "shop_paused").maybeSingle().then(({ data }) => setOn(data?.value === true)); }, []);
  async function toggle() {
    const v = !on;
    setOn(v);
    const sb = createClient();
    const { error } = await sb.from("site_settings").upsert({ key: "shop_paused", value: v, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) { setOn(!v); return toast(error.message, "err"); }
    // đọc lại để chắc đã lưu đúng
    const { data } = await sb.from("site_settings").select("value").eq("key", "shop_paused").maybeSingle();
    if ((data?.value === true) !== v) { setOn(data?.value === true); return toast("Chưa lưu được trạng thái — thử lại hoặc kiểm tra quyền admin.", "err"); }
    await revalidatePublic(["/dat-don", "/gio-hang", "/san-pham"], true);
    toast(v ? "Đã tạm nghỉ bán — trang Đặt đơn hiện thông báo tạm ngưng" : "Đã mở bán lại");
  }
  return (
    <button type="button" role="switch" aria-checked={!!on} onClick={toggle} disabled={on === null}
      className={cx("inline-flex h-9 items-center gap-2 rounded-[8px] border px-3 text-[14px] font-medium", on ? "border-[#f59e0b] bg-[#fffbeb] text-[#b45309]" : "border-[#e5e5e7] bg-white text-[#18181b]")}>
      <span className={cx("relative h-5 w-9 rounded-full transition-colors", on ? "bg-[#f59e0b]" : "bg-[#d4d4d8]")}><span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]", on ? "left-[18px]" : "left-0.5")} /></span>
      Tạm nghỉ bán
    </button>
  );
}
