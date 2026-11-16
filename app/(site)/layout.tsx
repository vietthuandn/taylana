import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { WavyLine } from "@/components/ui/Shapes";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      {/* isolate: đường lượn trang trí nằm dưới nội dung */}
      <main className="relative isolate flex-1 overflow-x-clip">
        <WavyLine />
        {children}
      </main>
      <Footer />
    </div>
  );
}
