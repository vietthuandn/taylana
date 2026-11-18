import { PageHeader } from "@/components/ui/PageHeader";
import { MyDesigns } from "./MyDesigns";

export const metadata = { title: "Thiết kế của tôi", robots: { index: false } };

export default function MyDesignsPage() {
  return (
    <>
      <PageHeader title="Thiết kế của tôi" />
      <MyDesigns />
    </>
  );
}
