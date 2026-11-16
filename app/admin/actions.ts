"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";

// Xoá bộ nhớ đệm để trang công khai hiện nội dung mới ngay sau khi admin lưu.
export async function revalidatePublic(paths: string[]) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return;
  for (const p of paths) revalidatePath(p);
}
