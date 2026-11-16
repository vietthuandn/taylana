import { PageHeader } from "@/components/ui/SectionTitle";
import { SubmitFiles } from "./SubmitFiles";

export const metadata = { title: "Nộp file" };

export default async function SubmitPage({ searchParams }: { searchParams: Promise<{ ma?: string }> }) {
  const { ma } = await searchParams;
  return (
    <>
      <PageHeader eyebrow="Đã có mã đơn" title="Nộp file in" subtitle="Tải từng file lên đúng ô — bạn thấy ngay bản in trông thế nào trên hộp CD, mặt đĩa và booklet." />
      <SubmitFiles initialCode={ma ?? ""} />
    </>
  );
}
