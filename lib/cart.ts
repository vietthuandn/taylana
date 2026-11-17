"use client";

/* Giỏ hàng: chưa đăng nhập → localStorage; đã đăng nhập → bảng cart_items theo tài khoản.
   Đăng nhập thì gộp giỏ localStorage vào giỏ tài khoản. Giá luôn được server tính lại khi đặt hàng. */
import { useSyncExternalStore } from "react";
import { createClient } from "./supabase/client";
import { hasSupabase } from "./supabase/env";

export type CartAddon = { id: string; qty: number };
// 1 dòng giỏ = sản phẩm + các lựa chọn (id) + số lượng. package_id / addons: dạng cũ (vẫn đọc được)
export type CartLine = {
  id: string; product_id: string | null; options: string[]; quantity: number; unit_price: number; created_at: string;
  package_id?: string | null; addons?: CartAddon[];
};
// đổi dòng dạng cũ (gói + phụ kiện) sang danh sách lựa chọn
const norm = (l: CartLine): CartLine => ({
  ...l,
  product_id: l.product_id ?? null,
  options: l.options?.length ? l.options : [l.package_id, ...(l.addons ?? []).filter((a) => a.qty > 0).map((a) => a.id)].filter(Boolean) as string[],
});

const LOCAL = "taylana-cart";
let lines: CartLine[] = [];
let userId: string | null = null;
let started = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

const sameOptions = (a: string[], b: string[]) => [...a].sort().join(",") === [...b].sort().join(",");
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function readLocal(): CartLine[] {
  try { return (JSON.parse(localStorage.getItem(LOCAL) || "[]") as CartLine[]).map(norm); } catch { return []; }
}
function writeLocal(v: CartLine[]) {
  try { localStorage.setItem(LOCAL, JSON.stringify(v)); } catch { /* bỏ qua */ }
}

async function loadDb(): Promise<CartLine[]> {
  const { data, error } = await createClient().from("cart_items").select("id, product_id, options, package_id, quantity, addons, unit_price, created_at").order("created_at");
  if (error) throw error;
  return ((data ?? []) as CartLine[]).map(norm);
}

// Ghi cả giỏ lên database (xoá dòng đã bỏ, cập nhật dòng còn lại)
async function saveDb(next: CartLine[], prev: CartLine[]) {
  const sb = createClient();
  const gone = prev.filter((p) => !next.some((n) => n.id === p.id)).map((p) => p.id);
  if (gone.length) await sb.from("cart_items").delete().in("id", gone);
  if (next.length) {
    await sb.from("cart_items").upsert(next.map((l) => ({
      id: l.id, user_id: userId, product_id: l.product_id, options: l.options, package_id: null, addons: [], quantity: l.quantity, unit_price: l.unit_price,
      updated_at: new Date().toISOString(),
    })));
  }
}

function set(next: CartLine[]) {
  const prev = lines;
  lines = next;
  emit();
  if (userId) saveDb(next, prev).catch(() => undefined);
  else writeLocal(next);
}

// Gộp 2 giỏ: dòng trùng gói + phụ kiện thì cộng số lượng
function merge(base: CartLine[], extra: CartLine[]) {
  const out = base.map((l) => ({ ...l }));
  for (const e of extra) {
    const hit = out.find((l) => (l.product_id ?? "") === (e.product_id ?? "") && sameOptions(l.options, e.options));
    if (hit) hit.quantity = Math.min(1000, hit.quantity + e.quantity);
    else out.push({ ...e, id: uuid() });
  }
  return out;
}

async function onUser(id: string | null) {
  if (id === userId && started) return;
  userId = id;
  if (!id) { lines = readLocal(); emit(); return; }
  try {
    const db = await loadDb();
    const local = readLocal();
    if (local.length) {
      const merged = merge(db, local);
      lines = merged; emit();
      await saveDb(merged, db);
      writeLocal([]);
    } else { lines = db; emit(); }
  } catch {
    // chưa chạy migration → vẫn dùng localStorage
    userId = null;
    lines = readLocal(); emit();
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  lines = readLocal();
  if (!hasSupabase) return;
  const sb = createClient();
  sb.auth.getUser().then(({ data }) => onUser(data.user?.id ?? null));
  sb.auth.onAuthStateChange((_e, s) => { const id = s?.user?.id ?? null; if (id !== userId) onUser(id); });
}

export const cart = {
  get: () => lines,
  add(l: Omit<CartLine, "id" | "created_at">) {
    set(merge(lines, [{ ...l, id: uuid(), created_at: new Date().toISOString() }]));
  },
  update(id: string, p: Partial<Pick<CartLine, "quantity" | "options" | "unit_price">>) {
    set(lines.map((l) => (l.id === id ? { ...l, ...p } : l)));
  },
  remove(ids: string[]) { set(lines.filter((l) => !ids.includes(l.id))); },
};

const subscribe = (f: () => void) => { start(); subs.add(f); return () => { subs.delete(f); }; };
const empty: CartLine[] = [];
export function useCart() {
  return useSyncExternalStore(subscribe, () => lines, () => empty);
}

// ---------- Mã đơn đã đặt trên trình duyệt này (cho "Đơn hàng của tôi" khi chưa đăng nhập) ----------
const MY = "taylana-my-orders";
export function savedOrderCodes(): string[] {
  try { return (JSON.parse(localStorage.getItem(MY) || "[]") as string[]).filter((x) => typeof x === "string"); } catch { return []; }
}
export function saveOrderCode(code: string) {
  try {
    const list = [code, ...savedOrderCodes().filter((c) => c.toUpperCase() !== code.toUpperCase())].slice(0, 50);
    localStorage.setItem(MY, JSON.stringify(list));
  } catch { /* bỏ qua */ }
}
