import { getGuidePage } from "@/lib/guide";
import { GuideView } from "@/components/guide/GuideView";

// Bản chia sẻ của trang Hướng dẫn làm file: chỉ 1 trang, không có thanh điều hướng / chân trang của web
export const metadata = { title: "Hướng dẫn làm file" };
export const revalidate = 60;

export default async function SharedGuidePage() {
  return <main className="ui-clean min-h-dvh bg-[#f7f7f8] font-sans text-[#18181b]"><GuideView {...await getGuidePage()} /></main>;
}
