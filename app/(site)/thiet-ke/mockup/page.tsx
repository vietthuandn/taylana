import { getTypePackages } from "@/lib/catalogLoad";
import { getMockupData } from "@/lib/mockup/load";
import { MockupLoader } from "./MockupLoader";

export const metadata = { title: "Xem Mockup CD" };
export const revalidate = 60;

// Xem Mockup CD: gói CD lấy từ nhóm "Loại" của sản phẩm kind = 'cd'
export default async function MockupPage() {
  const [packages, data] = await Promise.all([getTypePackages(), getMockupData()]);
  return <MockupLoader packages={packages} {...data} />;
}
