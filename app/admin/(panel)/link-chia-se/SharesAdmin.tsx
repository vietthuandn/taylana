"use client";
import { readUrls, storageUsage } from "@/lib/storage/client";

/* Admin → Link chia sẻ: link xem mockup còn hạn (ảnh nhỏ, ngày tạo, hết hạn sau, lượt xem) — Sao chép · Mở ·
   "Gia hạn thêm 24 giờ" · "Thu hồi ngay" (xoá file qua Storage API + xoá dữ liệu). Đầu trang: dung lượng bucket mockup-shares. */
import { useCallback, useEffect, useState } from "react";
import { Clock, Copy, ExternalLink, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { revokeShare } from "@/lib/mockupShare/create";
import { SHARE_TTL_MS, fmtLeft, type ShareRow } from "@/lib/mockupShare/types";
import { Button, Card, EmptyState, Message, confirmDialog, toast } from "@/components/admin/ui";

type Msg = { type: "ok" | "err"; text: string } | null;
const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

export function SharesAdmin() {
  const [rows, setRows] = useState<ShareRow[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [usage, setUsage] = useState<number | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const load = useCallback(async () => {
    const sb = createClient();
    const [r, u] = await Promise.all([sb.from("mockup_shares").select("*").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }), storageUsage("mockup-shares/").catch(() => null)]);
    if (r.error) setMsg({ type: "err", text: "Chưa có bảng chia sẻ — cần chạy supabase/migration_mockup_shares.sql." });
    const list = (r.data ?? []) as ShareRow[];
    setRows(list); setUsage(u ? u.total_bytes : 0); setNow(Date.now());
    const paths = list.map((x) => x.state?.thumb).filter(Boolean) as string[];
    if (paths.length) {
      const s = await readUrls(paths.map((p) => `mockup-shares/${p}`)).catch(() => ({} as Record<string, string>));
      setThumbs(Object.fromEntries(paths.filter((p) => s[`mockup-shares/${p}`]).map((p) => [p, s[`mockup-shares/${p}`]])));
    }
    setReady(true);
  }, []);
  useEffect(() => { load(); }, [load]);
  const url = (t: string) => `${location.origin}/m/${t}`;

  async function revoke(r: ShareRow) {
    if (!await confirmDialog("Link sẽ ngừng hoạt động ngay, ảnh và dữ liệu của link bị xoá hẳn.", { title: "Thu hồi link này?", ok: "Thu hồi ngay", danger: true })) return;
    try { await revokeShare(r.id); setMsg({ type: "ok", text: "Đã thu hồi link." }); } catch (e) { setMsg({ type: "err", text: e instanceof Error ? e.message : "Thu hồi thất bại" }); }
    await load();
  }
  async function extend(r: ShareRow) {
    const next = new Date(Math.max(Date.now(), new Date(r.expires_at).getTime()) + SHARE_TTL_MS).toISOString();
    const { error } = await createClient().from("mockup_shares").update({ expires_at: next }).eq("id", r.id);
    if (error) return setMsg({ type: "err", text: error.message });
    setMsg({ type: "ok", text: "Đã gia hạn thêm 24 giờ." });
    await load();
  }

  if (!ready) return <p className="text-[13px] text-[#71717a]">Đang tải...</p>;
  return (
    <div className="space-y-6">
      <Card title="Dung lượng đang dùng">
        <p className="text-[24px] font-semibold tabular-nums text-[#18181b]">{usage === null ? "—" : fmtSize(usage)}</p>
        <p className="text-[12px] text-[#71717a]">Bucket riêng tư “mockup-shares”. Link hết hạn được tự xoá (ảnh + dữ liệu) mỗi 15 phút.</p>
      </Card>
      <Card title={`Link đang còn hạn (${rows.length})`}>
        {rows.length ? (
          <ul className="divide-y divide-[#efeff1]">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[8px] bg-[#f4f4f5]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {r.state?.thumb && thumbs[r.state.thumb] && <img src={thumbs[r.state.thumb]} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{r.state?.pkgName ?? "Mockup"}</p>
                  <p className="text-[12px] text-[#71717a]">Tạo {new Date(r.created_at).toLocaleString("vi-VN")} · hết hạn sau {fmtLeft(new Date(r.expires_at).getTime() - now)} · {r.view_count} lượt xem</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={async () => { try { await navigator.clipboard.writeText(url(r.token)); toast("Đã sao chép link"); } catch { toast("Không sao chép được", "err"); } }}>Sao chép</Button>
                  <Button size="sm" variant="secondary" icon={<ExternalLink size={14} />} onClick={() => window.open(url(r.token), "_blank", "noopener")}>Mở</Button>
                  <Button size="sm" variant="secondary" icon={<Clock size={14} />} onClick={() => extend(r)}>Gia hạn thêm 24 giờ</Button>
                  <Button size="sm" variant="secondary" className="!text-[#dc2626]" icon={<Trash2 size={14} />} onClick={() => revoke(r)}>Thu hồi ngay</Button>
                </div>
              </li>
            ))}
          </ul>
        ) : <EmptyState>Chưa có link nào còn hạn. Tạo link ở trang Xem Mockup → nút “Chia sẻ”.</EmptyState>}
      </Card>
      <Message msg={msg} />
    </div>
  );
}
