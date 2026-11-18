"use client";

/** Thiết bị có xem 3D được không (có WebGL + không quá yếu). Tách riêng để không kéo three vào trang. */
export function can3D() {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    if (!(c.getContext("webgl2") || c.getContext("webgl"))) return false;
  } catch { return false; }
  const nav = navigator as Navigator & { deviceMemory?: number };
  if ((nav.hardwareConcurrency ?? 4) <= 2 || (nav.deviceMemory ?? 4) < 2) return false;
  return true;
}
