import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { SiteSkin } from "@/components/site/SiteSkin";

// Trang nào có phần tử [data-fit-screen] (ví dụ Custom CD) thì trên máy tính
// cả trang cao đúng 1 màn hình, không cuộn.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col md:has-[[data-fit-screen]]:h-dvh md:has-[[data-fit-screen]]:overflow-hidden">
      <Header />
      <main className="relative isolate flex flex-1 flex-col overflow-x-clip md:has-[[data-fit-screen]]:min-h-0"><SiteSkin>{children}</SiteSkin></main>
      <Footer />
    </div>
  );
}
