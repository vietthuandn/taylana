import { Suspense } from "react";
import { getTypePackages } from "@/lib/catalogLoad";
import { getLyricsSettings } from "@/lib/lyricsBooklet/load";
import { LyricsLoader } from "./LyricsLoader";

export const metadata = { title: "Booklet Lyrics" };
export const revalidate = 60;

// gói "Combo + Booklet N trang" theo số trang (để nút "Đặt in booklet này" chọn sẵn đúng gói)
export default async function Page() {
  const [settings, packages] = await Promise.all([getLyricsSettings(), getTypePackages()]);
  const packIds: Record<number, string> = {};
  for (const p of packages) {
    const n = p.front_pages ?? 0;
    if (n >= 4 && !packIds[n]) packIds[n] = p.id;
  }
  return <Suspense><LyricsLoader settings={settings} packIds={packIds} /></Suspense>;
}
