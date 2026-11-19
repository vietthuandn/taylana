import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin";
import { getTypePackages } from "@/lib/catalogLoad";
import type { Pack } from "@/lib/printShop/types";
import { BanIn } from "./BanIn";

export const metadata = { title: "Bàn in" };

// Admin → Bàn in: nhập đơn trong ngày, kéo thả file vào từng đơn, kiểm tra đủ ảnh, in hàng loạt theo nhóm (mỗi lần 1 mặt)
export default async function Page() {
  await requireAdmin();
  const packs: Pack[] = (await getTypePackages()).map((p) => ({ id: p.id, name: p.name, front: p.front_pages ?? 0, back: p.back_pages ?? 0, disc: !!p.has_disc }));
  return <Suspense><BanIn packs={packs} /></Suspense>;
}
