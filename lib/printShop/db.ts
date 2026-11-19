"use client";
/* Bàn in — đọc / ghi database (chỉ admin, RLS). Chưa chạy migration → thông báo rõ. */
import { createClient } from "@/lib/supabase/client";
import type { Addon, Batch, Item, Order, Progress, Rule } from "./types";

export const MIGRATE = "Chưa có bảng Bàn in — cần chạy supabase/migration_ban_in.sql.";
const sb = () => createClient();
const chk = <T,>(r: { data: T | null; error: { message: string } | null }) => {
  if (r.error) throw new Error(/print_|schema cache|does not exist/i.test(r.error.message) ? MIGRATE : r.error.message);
  return r.data as T;
};

export const listBatches = async () => chk(await sb().from("print_batches").select("*").order("created_at", { ascending: false }).limit(100)) as Batch[];
export const getBatch = async (id: string) => chk(await sb().from("print_batches").select("*").eq("id", id).maybeSingle()) as Batch | null;
export const createBatch = async (name: string) => chk(await sb().from("print_batches").insert({ name }).select("*").single()) as Batch;
export const patchBatch = async (id: string, v: Partial<Batch>) => { chk(await sb().from("print_batches").update(v).eq("id", id)); };
export const deleteBatch = async (id: string) => { chk(await sb().from("print_batches").delete().eq("id", id)); };
export const saveProgress = (id: string, progress: Progress) => patchBatch(id, { progress });

export const listOrders = async (batch: string) => chk(await sb().from("print_orders").select("*").eq("batch_id", batch).order("seq")) as Order[];
export async function insertOrders(rows: Omit<Order, "id" | "status" | "created_at">[]) {
  if (!rows.length) return [] as Order[];
  return chk(await sb().from("print_orders").insert(rows).select("*")) as Order[];
}
export const patchOrder = async (id: string, v: Partial<Order>) => { chk(await sb().from("print_orders").update(v).eq("id", id)); };
export const patchOrders = async (ids: string[], v: Partial<Order>) => { if (ids.length) chk(await sb().from("print_orders").update(v).in("id", ids)); };
export const deleteOrder = async (id: string) => { chk(await sb().from("print_orders").delete().eq("id", id)); };

export async function listItems(orderIds: string[]) {
  if (!orderIds.length) return [] as Item[];
  const out: Item[] = [];
  for (let i = 0; i < orderIds.length; i += 200) out.push(...(chk(await sb().from("print_items").select("*").in("order_id", orderIds.slice(i, i + 200))) as Item[]));
  return out;
}
export const upsertItem = async (v: Omit<Item, "id">) => chk(await sb().from("print_items").upsert(v, { onConflict: "order_id,slot" }).select("*").single()) as Item;
export const deleteItem = async (order_id: string, slot: string) => { chk(await sb().from("print_items").delete().eq("order_id", order_id).eq("slot", slot)); };

export const listRules = async () => chk(await sb().from("print_variation_rules").select("*").order("sort_order").order("created_at")) as Rule[];
export const insertRule = async (v: Partial<Rule>) => chk(await sb().from("print_variation_rules").insert(v).select("*").single()) as Rule;
export const patchRule = async (id: string, v: Partial<Rule>) => { chk(await sb().from("print_variation_rules").update(v).eq("id", id)); };
export const deleteRule = async (id: string) => { chk(await sb().from("print_variation_rules").delete().eq("id", id)); };

export const listAddons = async () => chk(await sb().from("print_addons").select("*").order("sort_order")) as Addon[];
export const upsertAddon = async (v: Partial<Addon>) => chk(await sb().from("print_addons").upsert(v).select("*").single()) as Addon;
export const deleteAddon = async (id: string) => { chk(await sb().from("print_addons").delete().eq("id", id)); };
