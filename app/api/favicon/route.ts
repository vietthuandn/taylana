/* Favicon (SVG) tô theo Màu chính của Theme (Admin → Giao diện → Theme). Bộ nhớ đệm 5 phút. */
import { getTheme } from "@/lib/themeLoad";

export const revalidate = 300;

export async function GET() {
  const c = (await getTheme().catch(() => null))?.primary ?? "#ff5fa2";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><g fill="${c}"><path d="M20 12h24v8H20z" opacity="0.85"/><path d="M12 22h40a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4h-4v-6H16v6h-4a4 4 0 0 1-4-4V26a4 4 0 0 1 4-4zm36 6a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/><path d="M18 38h28v10l-6 6H18V38zm21 15l6-6h-6v6z" opacity="0.9"/></g></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300, s-maxage=300" } });
}
