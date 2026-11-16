import type { Metadata, Viewport } from "next";
import "@fontsource/itim/400.css";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Tiệm In Taylana — Thiết kế & thi công CD", template: "%s · Tiệm In Taylana" },
  description: "Tiệm In Taylana: thiết kế & thi công CD theo yêu cầu, custom bìa, mặt đĩa, booklet, photostrip.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffd9e3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
