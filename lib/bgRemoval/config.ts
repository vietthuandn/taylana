/* Bộ tách nền AI chạy trên trình duyệt (onnxruntime-web, WebGPU nếu có, không thì WASM — trong Web Worker).
   Chỉ dùng mô hình có giấy phép cho phép dùng thương mại:
   - "Chân dung": MODNet (ZHKKKe/MODNet, Apache-2.0) — bản ONNX lượng tử hoá của Xenova/modnet, ~6.6 MB. Alpha matting, viền tóc mềm.
   - "Đồ vật": U²-Netp (xuebinqin/U-2-Net, Apache-2.0) — bản ONNX nhỏ ~4.6 MB, ảnh vào 320 × 320.
   KHÔNG dùng briaai/RMBG (phi thương mại) hay @imgly/background-removal (AGPL).
   Muốn tự lưu trữ: tải 2 file .onnx lên bucket Supabase (công khai) rồi đổi `url` bên dưới. Mô hình được lưu vào Cache Storage
   của trình duyệt sau lần tải đầu (đổi `cacheName` để buộc tải lại). */
export const BG_CONFIG = {
  ortVersion: "1.30.0",
  ortUrl: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort.webgpu.min.mjs", // bản có cả WebGPU + WASM
  ortWasmBase: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/",
  cacheName: "taylana-bg-models-v1",
  runSize: 1024, // thu ảnh về cạnh dài 1024px để chạy mô hình
  maxSide: 2048, // ảnh gốc giữ tối đa cạnh dài 2048px (mặt nạ phóng lại đúng kích thước này)
  models: {
    portrait: { name: "MODNet (lượng tử hoá)", license: "Apache-2.0", sizeMB: 6.6, url: "https://huggingface.co/Xenova/modnet/resolve/main/onnx/model_quantized.onnx" },
    object: { name: "U²-Netp", license: "Apache-2.0", sizeMB: 4.6, url: "https://huggingface.co/BritishWerewolf/U-2-Netp/resolve/main/onnx/model.onnx", input: 320 },
  },
} as const;
export type BgModel = keyof typeof BG_CONFIG.models;
