import { PageTitle } from "@/components/site/PageTitle";
import { SubmitFiles } from "./SubmitFiles";

export const metadata = { title: "Nộp file" };

export default async function SubmitPage({ searchParams }: { searchParams: Promise<{ ma?: string }> }) {
  const { ma } = await searchParams;
  return (
    <>
      <PageTitle title="Nộp file in" subtitle="Tải từng file lên đúng ô — bạn sẽ thấy ngay bản in trông thế nào trên hộp CD, mặt đĩa và booklet." />
      <SubmitFiles initialCode={ma ?? ""} />
    </>
  );
}
