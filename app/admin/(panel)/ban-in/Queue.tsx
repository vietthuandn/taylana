"use client";
import type { Addon, Batch, Item, Order, Pack, Slot } from "@/lib/printShop/types";
export function Queue(p: { batch: Batch; orders: Order[]; packs: Pack[]; addons: Addon[]; items: Item[]; slotsFor: (o: Order) => Slot[]; onBatch: (b: Batch) => void; onOrders: (ids: string[], v: Partial<Order>) => void; onClose: () => void }) {
  void p; return null;
}
