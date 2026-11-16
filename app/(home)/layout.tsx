import { Header } from "@/components/site/Header";
import { CompactFooter } from "@/components/site/Footer";
import { WavyLine } from "@/components/ui/Shapes";

// Trang chủ: header + nội dung 1 màn hình + footer gọn
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="relative isolate flex flex-1 flex-col overflow-x-clip">
        <WavyLine />
        {children}
      </main>
      <CompactFooter />
    </div>
  );
}
