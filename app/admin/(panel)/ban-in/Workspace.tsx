"use client";
import type { Pack } from "@/lib/printShop/types";
export function Workspace({ batchId, packs }: { batchId: string; packs: Pack[] }) {
  void packs;
  return <p className="p-6 text-[13px]">Phiên {batchId}</p>;
}
