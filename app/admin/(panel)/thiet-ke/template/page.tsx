import { redirect } from "next/navigation";
import { TEMPLATE_TABS } from "./Tabs";

// /admin/thiet-ke/template[?tab=…] → tab tương ứng (mặc định CD Template)
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab;
  redirect(`/admin/thiet-ke/template/${TEMPLATE_TABS.some(([id]) => id === tab) ? tab : "cd-template"}`);
}
