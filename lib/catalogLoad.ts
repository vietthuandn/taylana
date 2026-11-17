import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicClient } from "@/lib/supabase/public";
import { FEATURE_PHOTOSTRIP, isPhotostripItem } from "@/lib/features";
import type { Addon, Package } from "@/lib/types";
import { kindOf, optionToPackage, typeGroup, type Option, type OptionGroup, type Product } from "./catalog";

// Đọc sản phẩm + nhóm tuỳ chọn + lựa chọn (chỉ cái đang bán). Chưa chạy migration_products.sql
// thì dựng tạm 1 sản phẩm từ bảng packages / addons cũ để web vẫn chạy.
export async function getCatalog(sb: SupabaseClient | null = publicClient(), includeInactive = false): Promise<Product[]> {
  if (!sb) return [];
  const [p, g, o] = await Promise.all([
    includeInactive ? sb.from("products").select("*").order("sort_order").order("created_at") : sb.from("products").select("*").eq("is_active", true).order("sort_order").order("created_at"),
    sb.from("option_groups").select("*").order("sort_order").order("created_at"),
    includeInactive ? sb.from("options").select("*").order("sort_order").order("created_at") : sb.from("options").select("*").eq("is_active", true).order("sort_order").order("created_at"),
  ]);
  if (p.error || g.error || o.error) return legacy(sb);
  const opts = ((o.data ?? []) as Option[]).filter((x) => FEATURE_PHOTOSTRIP || !isPhotostripItem(x.name));
  const groups = ((g.data ?? []) as Omit<OptionGroup, "options">[]).map((x) => ({ ...x, options: opts.filter((y) => y.group_id === x.id) }));
  return ((p.data ?? []) as Omit<Product, "groups">[]).map((x) => ({ ...x, images: x.images ?? [], groups: groups.filter((y) => y.product_id === x.id) }));
}

async function legacy(sb: SupabaseClient): Promise<Product[]> {
  const [p, a] = await Promise.all([
    sb.from("packages").select("*").eq("is_active", true).order("sort_order"),
    sb.from("addons").select("*").eq("is_active", true).order("sort_order"),
  ]);
  const pk = (p.data ?? []) as Package[];
  const ad = ((a.data ?? []) as Addon[]).filter((x) => FEATURE_PHOTOSTRIP || !isPhotostripItem(x.name));
  if (!pk.length) return [];
  const opt = (x: { id: string; name: string; price: number; description: string; image_url: string | null; sort_order: number }, gid: string, extra: Partial<Option> = {}): Option => ({
    id: x.id, group_id: gid, name: x.name, price: x.price, description: x.description ?? "", image_url: x.image_url,
    front_pages: null, back_pages: null, has_disc: null, is_active: true, sort_order: x.sort_order, ...extra,
  });
  return [{
    id: "legacy", kind: "cd", slug: "in-cd-theo-yeu-cau", name: "In CD theo yêu cầu", description: "", is_active: true, sort_order: 0,
    images: [...new Set(pk.flatMap((x) => [...(x.images ?? []), x.image_url ?? ""]).filter(Boolean))],
    groups: [
      { id: "g-type", product_id: "legacy", name: "Loại", select_type: "single", required: true, sort_order: 1,
        options: pk.map((x) => opt(x, "g-type", { image_url: x.images?.[0] ?? x.image_url, front_pages: x.front_pages ?? null, back_pages: x.back_pages ?? null, has_disc: x.has_disc ?? null })) },
      { id: "g-add", product_id: "legacy", name: "Mua kèm", select_type: "multi", required: false, sort_order: 2, options: ad.map((x) => opt(x, "g-add")) },
    ],
  }];
}

// Các "Loại" (dạng Package cũ, có preset trang) — CHỈ của sản phẩm CD (kind = 'cd').
// Dùng cho trình chỉnh CD và Gửi file CD. Không bao giờ lấy lựa chọn của sản phẩm khác.
export async function getTypePackages(): Promise<Package[]> {
  const sb = publicClient();
  if (!sb) return [];
  const cd = (await getCatalog(sb)).find((p) => kindOf(p) === "cd");
  const g = typeGroup(cd);
  if (cd && g && g.options.length) return g.options.map((o) => optionToPackage(o, cd));
  // chưa có sản phẩm CD (chưa chạy migration) → đọc bảng gói CD cũ
  const { data } = await sb.from("packages").select("*").eq("is_active", true).order("sort_order");
  return (data ?? []) as Package[];
}
