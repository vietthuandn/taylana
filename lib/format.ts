export function formatVND(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

export function formatDate(s: string | null | undefined, withTime = true) {
  if (!s) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(s));
}

export function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

export const statusLabels: Record<string, string> = {
  new: "Mới",
  in_progress: "Đang làm",
  delivered: "Đã giao",
};

export const orderTypeLabels: Record<string, string> = {
  cd: "Đặt CD",
  custom_cd: "Custom CD",
  photostrip: "Photostrip",
};
