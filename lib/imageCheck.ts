"use client";
import { DPI, mmToPx, type PrintSpec } from "./print";

export const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
export const MAX_MB = 30;

export type CheckResult = {
  width?: number;
  height?: number;
  dpi?: number;
  level: "ok" | "warn" | "bad";
  messages: string[];
};

// Đọc kích thước ảnh (không nén, không thay đổi file)
export function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh"));
    };
    img.src = url;
  });
}

export function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Chỉ nhận file JPG, PNG hoặc PDF";
  if (file.size > MAX_MB * 1024 * 1024) return `File quá lớn (tối đa ${MAX_MB}MB)`;
  return null;
}

export async function checkImage(file: File, spec: PrintSpec): Promise<CheckResult> {
  if (file.type === "application/pdf") {
    return { level: "ok", messages: ["File PDF: tiệm sẽ tự kiểm tra kích thước khi in."] };
  }
  const { width, height } = await readImageSize(file);
  const messages: string[] = [];
  let level: CheckResult["level"] = "ok";

  // Độ phân giải thực tế khi in ở đúng khổ
  const dpi = Math.round(Math.min(width / (spec.w / 25.4), height / (spec.h / 25.4)));
  const need = `${mmToPx(spec.w)} x ${mmToPx(spec.h)} px`;
  if (dpi < 200) {
    level = "bad";
    messages.push(`Độ phân giải thấp (~${dpi} DPI). Ảnh in ra sẽ bị mờ — nên dùng ảnh khoảng ${need}.`);
  } else if (dpi < DPI - 20) {
    level = "warn";
    messages.push(`Độ phân giải hơi thấp (~${dpi} DPI, chuẩn ${DPI}). Nên dùng ảnh khoảng ${need}.`);
  }

  // Tỉ lệ khung
  const want = spec.w / spec.h;
  const got = width / height;
  if (Math.abs(got - want) / want > 0.02) {
    if (level === "ok") level = "warn";
    const rotated = Math.abs(1 / got - want) / want <= 0.02;
    messages.push(
      rotated
        ? "Ảnh đang bị xoay ngang/dọc ngược so với khổ in."
        : `Sai tỉ lệ (cần ${spec.w / 10} x ${spec.h / 10} cm). Phần thừa sẽ bị cắt như trong hình xem trước.`,
    );
  }
  if (!messages.length) messages.push(`Ảnh đạt chuẩn (~${dpi} DPI) ✓`);
  return { width, height, dpi, level, messages };
}
