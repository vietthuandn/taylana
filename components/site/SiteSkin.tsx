"use client";

/* Giao diện tối giản (giống Admin) cho các trang khách — trừ Trang chủ và Custom CD. */
import { usePathname } from "next/navigation";
import { AdminOverlays } from "@/components/ui/kit";

const KEEP_OLD = ["/custom-cd", "/thiet-ke/cd"]; // trình chỉnh thiết kế: giữ giao diện riêng

export function SiteSkin({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (KEEP_OLD.some((p) => path === p || path.startsWith(p + "/"))) return <>{children}</>;
  return (
    <div className="ui-clean flex flex-1 flex-col pb-6">
      {children}
      <AdminOverlays />
    </div>
  );
}
