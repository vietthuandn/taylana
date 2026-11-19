/* Mẫu 5 · Bảng Điều Khiển — trang chủ dạng dashboard: hiện TẤT CẢ mọi thứ trong web trên 1 màn hình.
   Thanh bên (điều hướng nhanh) · thẻ chào + nút chính · thẻ "lối tắt" · quy trình 4 bước · các nhóm: Đặt hàng / Thiết kế / Gửi file / Khám phá
   · 6 ô nổi bật của Admin → Trang chủ · hỗ trợ.
   Danh sách lấy từ lib/services, lib/designTools, lib/uploadTools → thêm trang mới ở đó thì dashboard tự cập nhật.
   Dữ liệu riêng (variant_settings["v5-dashboard"], không bắt buộc): { greeting?: string, note?: string }
   Mẫu tự chứa toàn bộ giao diện — không import mẫu khác. */
import Link from "next/link";
import {
  ArrowRight, BookOpen, Boxes, CircleHelp, Disc3, FileUp, Images, LayoutDashboard, MessageCircle, Package,
  Palette, ReceiptText, ShoppingBag, ShoppingCart, Sparkles, Store, UploadCloud, WandSparkles,
} from "lucide-react";
import type { HomeVariantProps } from "@/lib/homeData";
import { services } from "@/lib/services";
import { designTools } from "@/lib/designTools";
import { uploadTools } from "@/lib/uploadTools";
import { FEATURE_PHOTOSTRIP, FEATURE_UPLOAD_FILES } from "@/lib/features";

const PINK = "#ff5fa2";
type Item = { href: string; title: string; desc: string; icon: React.ReactNode };
type Group = { id: string; title: string; hint: string; tone: string; items: Item[] };
const plain = (s: string) => s.replace(/\[|\]/g, "");
const svc = (href: string) => services.find((s) => s.href === href);

function groups(): Group[] {
  return allGroups().filter((g) => FEATURE_UPLOAD_FILES || g.id !== "gui-file");
}
function allGroups(): Group[] {
  return [
    {
      id: "dat-hang", title: "Đặt hàng", hint: "Chọn gói, thanh toán, theo dõi đơn", tone: "#fff0f6",
      items: [
        { href: "/dat-don", title: svc("/dat-don")?.title ?? "Đặt đơn", desc: svc("/dat-don")?.desc ?? "Chọn gói CD & phụ kiện", icon: <ShoppingBag size={18} /> },
        { href: "/san-pham", title: "Sản phẩm", desc: "Xem các gói CD, giá và phụ kiện", icon: <Package size={18} /> },
        { href: "/gio-hang", title: "Giỏ hàng", desc: "Kiểm tra món đã chọn trước khi đặt", icon: <ShoppingCart size={18} /> },
        { href: "/don-hang-cua-toi", title: "Đơn hàng của tôi", desc: "Tra cứu trạng thái, thanh toán, gửi file", icon: <ReceiptText size={18} /> },
      ],
    },
    {
      id: "thiet-ke", title: "Thiết kế", hint: "Tự làm bìa, xem thử trên hộp CD", tone: "#f3f0ff",
      items: [
        ...designTools.filter((t) => !t.hidden).map((t) => ({ href: t.href, title: t.title, desc: t.desc, icon: t.kind === "cd-mockup" ? <Boxes size={18} /> : <Disc3 size={18} /> })),
        { href: "/thiet-ke-cua-toi", title: "Thiết kế của tôi", desc: "Mở lại các bản thiết kế đã lưu", icon: <Palette size={18} /> },
        ...(FEATURE_PHOTOSTRIP ? [{ href: "/photostrip", title: "Làm Photostrip", desc: "Ghép dải ảnh 3–4 khung", icon: <Images size={18} /> }] : []),
      ],
    },
    {
      id: "gui-file", title: "Gửi file", hint: "Gửi ảnh in & link nhạc cho đơn", tone: "#ecfdf3",
      items: [
        ...uploadTools.map((t) => ({ href: t.href, title: t.title, desc: t.desc, icon: <UploadCloud size={18} /> })),
        { href: "/huong-dan", title: "Hướng dẫn làm file", desc: svc("/huong-dan")?.desc ?? "Kích thước bìa, đĩa, booklet", icon: <BookOpen size={18} /> },
      ],
    },
    {
      id: "kham-pha", title: "Khám phá", hint: "Về tiệm & những gì tiệm đã làm", tone: "#fffbeb",
      items: [
        { href: "/ve-chung-toi", title: "Về chúng tôi", desc: svc("/ve-chung-toi")?.desc ?? "Những sản phẩm tiệm đã làm", icon: <Store size={18} /> },
        { href: "/lien-he", title: "Liên hệ", desc: "Nhắn tiệm qua Zalo, Facebook", icon: <MessageCircle size={18} /> },
      ],
    },
  ];
}

const STEPS = [
  { n: 1, title: "Chọn gói", href: "/dat-don", icon: <ShoppingBag size={16} /> },
  { n: 2, title: "Thiết kế / chuẩn bị file", href: "/thiet-ke", icon: <WandSparkles size={16} /> },
  FEATURE_UPLOAD_FILES ? { n: 3, title: "Gửi file", href: "/gui-file", icon: <FileUp size={16} /> } : { n: 3, title: "Lên mockup", href: "/thiet-ke/mockup", icon: <Boxes size={16} /> },
  { n: 4, title: "Nhận CD", href: "/don-hang-cua-toi", icon: <Disc3 size={16} /> },
];

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[16px] border border-[#e5e5e7] bg-white p-5 ${className}`}>{children}</section>;
}
function CardHead({ title, hint, href }: { title: string; hint?: string; href?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="font-sans text-[16px] font-semibold normal-case tracking-[-0.01em] text-[#18181b]">{title}</h2>
        {hint && <p className="mt-0.5 text-[13px] text-[#71717a]">{hint}</p>}
      </div>
      {href && <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-[#ff5fa2] hover:text-[#e0468a]">Xem <ArrowRight size={14} /></Link>}
    </div>
  );
}

export default function HomeV5({ home, options, settings }: HomeVariantProps) {
  const list = groups();
  const greeting = (settings.greeting as string) || "Xin chào 👋";
  const note = (settings.note as string) || "Mọi thứ của Tiệm In Taylana ở ngay đây — chọn việc bạn muốn làm.";
  const shortcuts = services.slice(0, 4);

  return (
    <div className="flex-1 bg-[#f7f7f8] font-sans text-[#18181b]">
      <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-6 lg:grid-cols-[220px_1fr] lg:px-6 lg:py-8">
        {/* ---------- Thanh bên ---------- */}
        <aside className="hidden lg:block">
          <nav className="sticky top-[calc(var(--header-h)+24px)] space-y-1 rounded-[16px] border border-[#e5e5e7] bg-white p-3">
            <p className="flex items-center gap-2 px-2 pb-2 pt-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]"><LayoutDashboard size={14} /> Bảng điều khiển</p>
            <a href="#tong-quan" className="flex items-center gap-2 rounded-[8px] bg-[#fff0f6] px-2.5 py-2 text-[14px] font-medium text-[#ff5fa2]"><Sparkles size={16} /> Tổng quan</a>
            {list.map((g) => (
              <a key={g.id} href={`#${g.id}`} className="flex items-center justify-between rounded-[8px] px-2.5 py-2 text-[14px] text-[#3f3f46] hover:bg-[#f4f4f5] hover:text-[#ff5fa2]">
                {g.title}<span className="rounded-full bg-[#f4f4f5] px-1.5 text-[11px] tabular-nums text-[#71717a]">{g.items.length}</span>
              </a>
            ))}
            <a href="#noi-bat" className="block rounded-[8px] px-2.5 py-2 text-[14px] text-[#3f3f46] hover:bg-[#f4f4f5] hover:text-[#ff5fa2]">Nổi bật</a>
            <div className="mt-3 rounded-[12px] bg-[#18181b] p-3 text-white">
              <p className="text-[13px] font-semibold">Cần giúp?</p>
              <p className="mt-0.5 text-[12px] text-white/70">Tiệm trả lời nhanh qua Zalo.</p>
              <Link href="/lien-he" className="mt-2 inline-flex h-8 items-center rounded-[8px] bg-white px-3 text-[12px] font-semibold text-[#18181b] hover:text-[#ff5fa2]">Liên hệ</Link>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 space-y-6">
          {/* ---------- Tổng quan ---------- */}
          <div id="tong-quan" className="grid scroll-mt-24 gap-6 xl:grid-cols-[1fr_320px]">
            <section className="relative overflow-hidden rounded-[16px] bg-[#18181b] p-6 text-white sm:p-8">
              <div aria-hidden className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#ff5fa2]/30 blur-3xl" />
              <div aria-hidden className="absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-[#8b5cf6]/25 blur-3xl" />
              <p className="relative text-[14px] text-white/70">{greeting}</p>
              <h1 className="relative mt-2 max-w-[560px] font-sans text-[28px] font-bold normal-case leading-[1.15] tracking-[-0.02em] text-white sm:text-[36px]">
                {plain(home.banner_title) || "CD của bạn, theo cách của bạn"}
              </h1>
              <p className="relative mt-3 max-w-[520px] text-[14px] leading-relaxed text-white/75">{home.banner_subtitle || note}</p>
              <div className="relative mt-6 flex flex-wrap gap-2">
                <Link href={home.btn1_href || "/dat-don"} className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-4 text-[14px] font-semibold text-white hover:opacity-90" style={{ background: PINK }}>
                  {home.btn1_label || "Đặt đơn ngay"} <ArrowRight size={16} />
                </Link>
                {home.btn2_enabled && home.btn2_label && (
                  <Link href={home.btn2_href || "/thiet-ke"} className="inline-flex h-10 items-center rounded-[10px] bg-white/10 px-4 text-[14px] font-semibold text-white hover:bg-white/20">{home.btn2_label}</Link>
                )}
                <Link href="/don-hang-cua-toi" className="inline-flex h-10 items-center rounded-[10px] bg-white/10 px-4 text-[14px] font-semibold text-white hover:bg-white/20">Tra cứu đơn</Link>
              </div>
            </section>

            {/* quy trình */}
            <Card>
              <CardHead title="Quy trình" hint="4 bước là có CD của riêng bạn" />
              <ol className="space-y-1">
                {STEPS.map((s, i) => (
                  <li key={s.n}>
                    <Link href={s.href} className="group flex items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-[#f7f7f8]">
                      <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#e5e5e7] bg-white text-[#52525b] group-hover:border-[#ff5fa2] group-hover:text-[#ff5fa2]">
                        {s.icon}
                        {i < STEPS.length - 1 && <span aria-hidden className="absolute left-1/2 top-full h-3 w-px -translate-x-1/2 bg-[#e5e5e7]" />}
                      </span>
                      <span className="min-w-0 flex-1 text-[14px] font-medium">{s.title}</span>
                      <span className="text-[12px] tabular-nums text-[#a1a1aa]">0{s.n}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Card>
          </div>

          {/* ---------- Lối tắt ---------- */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {shortcuts.map((s) => (
              <Link key={s.href} href={s.href} className="group rounded-[14px] border border-[#e5e5e7] bg-white p-4 transition-colors hover:border-[#ff5fa2]">
                <p className="text-[12px] text-[#71717a]">{s.short}</p>
                <p className="mt-1 text-[15px] font-semibold leading-snug group-hover:text-[#ff5fa2]">{s.title}</p>
                <p className="mt-1 line-clamp-1 text-[12px] text-[#a1a1aa]">{s.desc}</p>
              </Link>
            ))}
          </div>

          {/* ---------- Các nhóm ---------- */}
          <div className="grid gap-6 md:grid-cols-2">
            {list.map((g) => (
              <Card key={g.id} className="scroll-mt-24">
                <div id={g.id} className="scroll-mt-24" />
                <CardHead title={g.title} hint={g.hint} />
                <ul className="divide-y divide-[#efeff1]">
                  {g.items.map((it) => (
                    <li key={it.href}>
                      <Link href={it.href} className="group flex items-center gap-3 py-2.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[#3f3f46] group-hover:text-[#ff5fa2]" style={{ background: g.tone }}>{it.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium group-hover:text-[#ff5fa2]">{it.title}</span>
                          <span className="block truncate text-[12px] text-[#71717a]">{it.desc}</span>
                        </span>
                        <ArrowRight size={15} className="shrink-0 text-[#d4d4d8] transition-transform group-hover:translate-x-0.5 group-hover:text-[#ff5fa2]" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          {/* ---------- Nổi bật: 6 ô của Admin → Trang chủ ---------- */}
          {options.length > 0 && (
            <Card className="scroll-mt-24">
              <div id="noi-bat" className="scroll-mt-24" />
              <CardHead title="Nổi bật" hint="Các mục tiệm muốn bạn xem trước" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {options.map((o, i) => (
                  <Link key={i} href={o.href || "/"} className="group relative block aspect-[4/3] overflow-hidden rounded-[12px] border border-[#e5e5e7]" style={{ background: o.bg || "#f4f4f5" }}>
                    {o.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.image_url} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8 text-[14px] font-semibold text-white">{plain(o.title)}</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* ---------- Hỗ trợ ---------- */}
          <Card className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff0f6] text-[#ff5fa2]"><CircleHelp size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">Chưa biết bắt đầu từ đâu?</p>
              <p className="text-[13px] text-[#71717a]">Đọc hướng dẫn làm file hoặc nhắn tiệm — tiệm tư vấn gói phù hợp cho bạn.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/huong-dan" className="inline-flex h-9 items-center rounded-[8px] border border-[#e5e5e7] px-3 text-[13px] font-medium hover:border-[#ff5fa2] hover:text-[#ff5fa2]">Hướng dẫn</Link>
              <Link href="/lien-he" className="inline-flex h-9 items-center rounded-[8px] px-3 text-[13px] font-semibold text-white hover:opacity-90" style={{ background: PINK }}>Liên hệ</Link>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
