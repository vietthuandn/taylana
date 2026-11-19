"use client";
import { PDFDocument } from "pdf-lib";
import type { Order, Pack, Slot } from "./types";
export async function pickingListPdf(orders: Order[], packs: Pack[], slotsFor: (o: Order) => Slot[], sections: unknown[]) {
  void orders; void packs; void slotsFor; void sections;
  const d = await PDFDocument.create(); d.addPage([595, 842]); return d.save();
}
