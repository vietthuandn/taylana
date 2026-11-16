import type { Metadata, Viewport } from "next";
import "@fontsource/anton/400.css";
import "@fontsource/bricolage-grotesque/700.css";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./globals.css";
import { ClipDefs } from "@/components/ui/Shapes";

export const metadata: Metadata = {
  title: { default: "Taylana — Thiết kế & thi công CD theo yêu cầu", template: "%s · Taylana" },
  description: "Tiệm In Taylana: thiết kế & thi công CD theo yêu cầu, custom bìa, mặt đĩa, booklet, photostrip.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f0e6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-dvh">
        <ClipDefs />
        {children}
      </body>
    </html>
  );
}
