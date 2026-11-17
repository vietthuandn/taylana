import { getTypePackages } from "@/lib/catalogLoad";
import { SendFiles } from "./SendFiles";

export const metadata = { title: "Gửi file" };

export default async function SendFilesPage({ searchParams }: { searchParams: Promise<{ don?: string; ma?: string }> }) {
  const { don, ma } = await searchParams; // ?ma= là link cũ
  const packages = await getTypePackages(); // các "Loại" của sản phẩm (có preset số trang)
  return <SendFiles packages={packages} orderCode={(don ?? ma ?? "").trim()} />;
}
