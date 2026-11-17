import { PageHeader } from "@/components/ui/PageHeader";
import { MyDesigns } from "./MyDesigns";

export const metadata = { title: "Thiết kế của tôi", robots: { index: false } };

export default function MyDesignsPage() {
  return (
    <>
      <PageHeader eyebrow="Tài khoản" title="Thiết kế của tôi" subtitle="Các thiết kế Custom CD bạn đã lưu." />
      <MyDesigns />
    </>
  );
}
