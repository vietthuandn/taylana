import { Header } from "@/components/site/Header";
import { ThemeShell } from "@/components/site/ThemeShell";

// Trang chủ: header + nội dung vừa 1 màn hình (100dvh trừ header)
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeShell className="flex min-h-dvh flex-col">
      <Header />
      <main className="relative isolate flex flex-1 flex-col overflow-x-clip">{children}</main>
    </ThemeShell>
  );
}
