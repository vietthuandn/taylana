import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@fontsource/anton/400.css";
import "@fontsource/bricolage-grotesque/400.css";
import "@fontsource/bricolage-grotesque/700.css";
import "./globals.css";
import { ClipDefs } from "@/components/ui/Shapes";
import { UploadProgress } from "@/components/ui/UploadProgress";

// Font thân bài toàn web
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  icons: { icon: [{ url: "/api/favicon", type: "image/svg+xml" }] }, // favicon theo màu chính của Theme
  title: { default: "Taylana — Thiết kế & thi công CD theo yêu cầu", template: "%s · Taylana" },
  description: "Tiệm In Taylana: thiết kế & thi công CD theo yêu cầu, custom bìa, mặt đĩa, booklet.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f0e6",
  viewportFit: "cover", // header tràn lên vùng tai thỏ (iPhone) — header tự chừa env(safe-area-inset-top)
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className="min-h-dvh">
        <ClipDefs />
        {children}
        <UploadProgress />
      </body>
    </html>
  );
}
