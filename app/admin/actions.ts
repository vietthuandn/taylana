"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

// Xoá bộ nhớ đệm để trang công khai hiện nội dung mới ngay sau khi admin lưu.
export async function revalidatePublic(paths: string[], layout = false) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return;
  if (layout) revalidatePath("/", "layout");
  for (const p of paths) revalidatePath(p);
}
