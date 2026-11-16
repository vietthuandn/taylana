import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { adminLinks } from "@/lib/adminLinks";

export default async function AdminHome() {
  const { supabase } = await requireAdmin();
  const { count: newOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl">Xin chào chủ tiệm ✿</h1>
      <p className="mt-1 text-cocoa-500">Đơn mới đang chờ: <b>{newOrders ?? 0}</b></p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {adminLinks.slice(1).map((l) =>
          l.soon ? (
            <div key={l.href} className="rounded-3xl border-2 border-dashed border-cocoa-300 px-4 py-5 text-cocoa-400">
              <p className="font-display text-lg">{l.label}</p>
              <p className="text-xs">Giai đoạn sau</p>
            </div>
          ) : (
            <Link key={l.href} href={l.href} className="pop rounded-3xl bg-matcha-100 px-4 py-5 hover:-translate-y-0.5 transition">
              <p className="font-display text-lg">{l.label}</p>
              <p className="text-xs text-cocoa-500">Mở →</p>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
