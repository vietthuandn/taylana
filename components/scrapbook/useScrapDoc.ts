"use client";
/* Thiết kế scrapbook của khách = danh sách bề mặt (đĩa: 1 · booklet: bìa + các cặp trang + trang cuối).
   Lịch sử hoàn tác / làm lại theo mốc (begin() trước mỗi thao tác). */
import { useCallback, useRef, useState } from "react";
import type { Layer, Template } from "@/lib/scrapbook/types";

type Snap = { doc: Template[] | null; edited: boolean };
const clone = <T,>(v: T): T => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));

export function useScrapDoc() {
  const [doc, setDocState] = useState<Template[] | null>(null);
  const [edited, setEdited] = useState(false); // đã sửa lớp của mẫu (không tính sticker / chữ khách tự thêm)
  const docRef = useRef<Template[] | null>(null), editedRef = useRef(false);
  docRef.current = doc; editedRef.current = edited;
  const undoS = useRef<Snap[]>([]), redoS = useRef<Snap[]>([]);
  const [, force] = useState(0);
  const begin = useCallback(() => {
    undoS.current.push({ doc: clone(docRef.current), edited: editedRef.current });
    if (undoS.current.length > 60) undoS.current.shift();
    redoS.current = [];
    force((t) => t + 1);
  }, []);
  const setDoc = useCallback((d: Template[] | null | ((c: Template[] | null) => Template[] | null)) => setDocState(d), []);
  /** sửa lớp của 1 bề mặt (không tự lưu mốc — gọi begin() trước) */
  const setLayers = useCallback((si: number, fn: (L: Layer[]) => Layer[], touched?: Layer) => {
    setDocState((d) => (d ? d.map((t, i) => (i === si ? { ...t, layers: fn(t.layers) } : t)) : d));
    if (!touched || !touched.user) setEdited(true);
  }, []);
  const patchSurface = useCallback((si: number, fn: (t: Template) => Template) => setDocState((d) => (d ? d.map((t, i) => (i === si ? fn(t) : t)) : d)), []);
  const undo = useCallback(() => { const s = undoS.current.pop(); if (!s) return false; redoS.current.push({ doc: clone(docRef.current), edited: editedRef.current }); setDocState(s.doc); setEdited(s.edited); return true; }, []);
  const redo = useCallback(() => { const s = redoS.current.pop(); if (!s) return false; undoS.current.push({ doc: clone(docRef.current), edited: editedRef.current }); setDocState(s.doc); setEdited(s.edited); return true; }, []);
  const reset = useCallback(() => { undoS.current = []; redoS.current = []; }, []);
  return { doc, setDoc, edited, setEdited, begin, setLayers, patchSurface, undo, redo, reset, canUndo: undoS.current.length > 0, canRedo: redoS.current.length > 0 };
}
export { clone };
