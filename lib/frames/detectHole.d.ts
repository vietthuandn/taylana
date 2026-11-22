import type { HoleRegion } from "@/lib/scrapbook/types";
export function detectHoles(rgba: Uint8ClampedArray, W: number, H: number, opt?: { thr?: number; minFrac?: number; eps?: number }): Omit<HoleRegion, "g">[];
export function quadOf(c: number[][]): [number, number][];
export function rdpClosed(c: number[][], eps: number): number[][];
