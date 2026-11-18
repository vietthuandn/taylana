import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ToolGrid } from "@/components/site/ToolGrid";
import { uploadHref, uploadTools } from "@/lib/uploadTools";

export const metadata = { title: "Gửi file" };

// Trang chọn loại sản phẩm để gửi file. Link có ?don=<mã> (hoặc ?ma=) đi thẳng tới đúng trang gửi file của đơn.
export default async function UploadToolsPage({ searchParams }: { searchParams: Promise<{ don?: string; ma?: string }> }) {
  const { don, ma } = await searchParams;
  const code = (don ?? ma ?? "").trim();
  if (code) redirect(uploadHref(code));
  return (
    <>
      <PageHeader title="Gửi file" subtitle="Chọn sản phẩm bạn muốn gửi file in." />
      <div className="mx-auto w-full max-w-[1200px] px-4 lg:px-6"><ToolGrid tools={uploadTools} /></div>
    </>
  );
}
