"use client";

/* Mô hình hộp CD dạng .glb do admin tải lên (tuỳ chọn). Quy ước đặt tên mesh:
   lid, base, front_cover_outer, front_cover_inner, back_card_outer, back_card_inner, disc_top, disc_bottom
   + 1 node "hinge_lid" làm trục mở nắp (xoay quanh trục Z cục bộ, chiều dương = mở).
   Ảnh khách dán theo UV của model. Thiếu mesh nào thì bỏ qua vùng đó. */
import type { Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const GLB_MESHES = ["lid", "base", "front_cover_outer", "front_cover_inner", "back_card_outer", "back_card_inner", "disc_top", "disc_bottom"] as const;
export const GLB_HINGE = "hinge_lid";
export type GlbName = (typeof GLB_MESHES)[number];

export async function loadGlb(url: string) {
  const g = await new GLTFLoader().loadAsync(url);
  return g.scene;
}

/** Tên node tìm thấy trong model + các tên quy ước còn thiếu */
export function inspectScene(root: Object3D) {
  const names = new Set<string>();
  root.traverse((o) => { if (o.name) names.add(o.name); });
  const need = [...GLB_MESHES, GLB_HINGE];
  return { found: [...names].sort(), missing: need.filter((n) => !names.has(n)) };
}

export async function inspectGlb(url: string) {
  return inspectScene(await loadGlb(url));
}
