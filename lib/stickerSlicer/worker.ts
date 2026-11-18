/// <reference lib="webworker" />
// Web Worker: tách tờ sticker không làm đơ trang
import { slice, type SliceParams } from "./core";

self.onmessage = (e: MessageEvent<{ data: Uint8ClampedArray; w: number; h: number; params: SliceParams }>) => {
  const { data, w, h, params } = e.data;
  try {
    const r = slice(data, w, h, params);
    (self as unknown as Worker).postMessage({ ok: true, ...r }, [r.rgba.buffer, r.labels.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
