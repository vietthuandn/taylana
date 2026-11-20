import { getGuidePage } from "@/lib/guide";
import { GuideView } from "@/components/guide/GuideView";

export const metadata = { title: "Hướng dẫn làm file" };
export const revalidate = 60;

export default async function GuidePage() {
  return <GuideView {...await getGuidePage()} />;
}
