"use client";
import type { Addon, Batch, Item, Order, Pack, Slot } from "@/lib/printShop/types";
export function PrintBar(p: { batch: Batch | null; orders: Order[]; selected: Order[]; packs: Pack[]; addons: Addon[]; items: Item[]; stat: (o: Order) => { total: number; n: number; full: boolean }; slotsFor: (o: Order) => Slot[]; onBatch: (b: Batch) => void; onOrders: (ids: string[], v: Partial<Order>) => void }) {
  void p;
  return null;
}
