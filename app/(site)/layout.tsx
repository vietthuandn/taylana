import { Header } from "@/components/site/Header";
import { SiteSkin } from "@/components/site/SiteSkin";
import { ThemeShell } from "@/components/site/ThemeShell";
import type { Viewport } from "next";
import { getTheme } from "@/lib/themeLoad";

// màu thanh trạng thái (trình duyệt điện thoại) = màu header · header gradient → màu đầu tiên của gradient
export async function generateViewport(): Promise<Viewport> {
  const t = await getTheme();
  const c = t.header_bg.match(/#[0-9a-f]{6}/i)?.[0];
  return c ? { themeColor: c } : {};
}

// Trang nào có phần tử [data-fit-screen] (ví dụ Custom CD) thì trên máy tính
// cả trang cao đúng 1 màn hình, không cuộn.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeShell className="flex min-h-dvh flex-col md:has-[[data-fit-screen]]:h-dvh md:has-[[data-fit-screen]]:overflow-hidden [&:has([data-editor])>header]:hidden">
      <Header />
      <main className="relative isolate flex flex-1 flex-col overflow-x-clip md:has-[[data-fit-screen]]:min-h-0"><SiteSkin>{children}</SiteSkin></main>
    </ThemeShell>
  );
}
