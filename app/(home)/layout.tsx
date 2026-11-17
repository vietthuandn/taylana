import { Header } from "@/components/site/Header";

// Trang chủ: header + nội dung vừa 1 màn hình (100dvh trừ header)
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f7f7f8]">
      <Header />
      <main className="relative isolate flex flex-1 flex-col overflow-x-clip">{children}</main>
    </div>
  );
}
