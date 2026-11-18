import "server-only";
import { publicClient } from "@/lib/supabase/public";
import { defaultGlass, type MockupBackground, type MockupFrame, type TrayStyle } from "./types";

// Mẫu khung + nền đang bật + cài đặt watermark (chưa chạy migration → rỗng)
export async function getMockupData() {
  const sb = publicClient();
  if (!sb) return { frames: [] as MockupFrame[], boxFrame: null as MockupFrame | null, backgrounds: [] as MockupBackground[], watermark: true, tray: "clear" as TrayStyle };
  const [f, b, s] = await Promise.all([
    sb.from("mockup_frames").select("*").eq("is_active", true).order("sort_order").order("created_at"),
    sb.from("mockup_backgrounds").select("*").eq("is_active", true).order("sort_order").order("created_at"),
    sb.from("site_settings").select("value").eq("key", "mockup").maybeSingle(),
  ]);
  const all = ((f.data ?? []) as MockupFrame[]).map((x) => ({ ...x, regions: x.regions ?? [], glass: { ...defaultGlass, ...(x.glass ?? {}) } }));
  const frames = all.filter((x) => !x.is_default_box).slice(0, 5);
  const boxFrame = all.find((x) => x.is_default_box) ?? null; // mẫu mặc định gói "CD + Hộp"
  const v = s.data?.value as { watermark?: boolean; tray?: string } | undefined;
  return { frames, boxFrame, backgrounds: (b.data ?? []) as MockupBackground[], watermark: v?.watermark !== false, tray: (v?.tray === "black" ? "black" : "clear") as TrayStyle };
}
