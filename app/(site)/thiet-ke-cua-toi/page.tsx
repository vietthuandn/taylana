import { PageHeader } from "@/components/ui/PageHeader";
import { getTypePackages } from "@/lib/catalogLoad";
import { MyDesigns } from "./MyDesigns";

export const metadata = { title: "Thiết kế của tôi", robots: { index: false } };
export const revalidate = 60;

export default async function MyDesignsPage() {
  const packages = await getTypePackages().catch(() => []);
  return (
    <>
      <PageHeader title="Thiết kế của tôi" />
      <MyDesigns packages={packages} />
    </>
  );
}
