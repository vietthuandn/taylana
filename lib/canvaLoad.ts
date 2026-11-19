import "server-only";
import { publicClient } from "@/lib/supabase/public";
import { mergeCanvaButton, type CanvaButton, type CanvaTemplate } from "./canva";

// Template Canva đang bật + cài đặt nút (chưa chạy migration → rỗng)
export async function getCanvaData(): Promise<{ templates: CanvaTemplate[]; button: CanvaButton }> {
  const sb = publicClient();
  if (!sb) return { templates: [], button: mergeCanvaButton(null) };
  const [t, s] = await Promise.all([
    sb.from("canva_templates").select("*").eq("is_active", true).order("sort_order").order("created_at"),
    sb.from("site_settings").select("value").eq("key", "canva_button").maybeSingle(),
  ]);
  return { templates: (t.data ?? []) as CanvaTemplate[], button: mergeCanvaButton((s.data?.value as Partial<CanvaButton>) ?? null) };
}
