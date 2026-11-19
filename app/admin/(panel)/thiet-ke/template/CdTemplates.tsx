"use client";
/* Quản lý template → CD Template: mẫu mặt đĩa cố định theo danh mục. (Mẫu cũ đã chuyển xong — nút "Chuyển mẫu cũ thành mẫu riêng"
   đã bỏ khỏi giao diện; code chuyển đổi vẫn giữ ở ./convert.ts.) */
import { LibraryAdmin } from "./LibraryAdmin";

export function CdTemplates() {
  return <LibraryAdmin kind="cd" />;
}
