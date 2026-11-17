import { publicClient } from "@/lib/supabase/public";
import type { Package } from "@/lib/types";
import { SendFiles } from "./SendFiles";

export const metadata = { title: "Gửi file in" };

export default async function SendFilesPage({ searchParams }: { searchParams: Promise<{ don?: string; ma?: string }> }) {
  const { don, ma } = await searchParams; // ?ma= là link cũ
  const sb = publicClient();
  let packages: Package[] = [];
  if (sb) {
    const { data } = await sb.from("packages").select("*").eq("is_active", true).order("sort_order");
    packages = data ?? [];
  }
  return <SendFiles packages={packages} orderCode={(don ?? ma ?? "").trim()} />;
}
