/* Mẫu 3 · Kết Nối — 6 mục nối thành 1 hành trình liền mạch, nét vẽ tay:
   Hướng dẫn → Thiết kế → Đặt đơn → Gửi file → Đánh giá → Liên hệ.
   Dữ liệu chung: Admin → Trang chủ (tiêu đề banner, tên + link 6 ô, màu ô dùng làm "bút dạ" cho số bước).
   Dữ liệu riêng (variant_settings["v3-ketnoi"], không bắt buộc):
     { kicker?: string, cta?: string, steps?: { verb?: string; desc?: string }[] }
   Mẫu tự chứa toàn bộ giao diện — không import mẫu khác. */
import "@fontsource/pangolin/400.css";
import Link from "next/link";
import type { HomeVariantProps } from "@/lib/homeData";
import type { HomeOption } from "@/lib/settings";

const HAND = { fontFamily: '"Pangolin", "Patrick Hand", "Comic Sans MS", cursive' } as const;
const INK = "#18181b";
const PINK = "#ff5fa2";

// Thứ tự hành trình + nhận diện ô tương ứng trong Admin theo link
const JOURNEY: { keys: string[]; href: string; title: string; verb: string; desc: string }[] = [
  { keys: ["huong-dan"], href: "/huong-dan", title: "Hướng dẫn làm file", verb: "Tìm hiểu", desc: "Đọc nhanh cách chuẩn bị ảnh & nhạc cho đúng khổ in." },
  { keys: ["thiet-ke", "custom-cd", "tu-thiet-ke"], href: "/thiet-ke", title: "Thiết Kế", verb: "Sáng tạo", desc: "Tự tay thiết kế bìa, booklet và mặt đĩa ngay trên web." },
  { keys: ["dat-don"], href: "/dat-don", title: "Đặt đơn", verb: "Chốt đơn", desc: "Chọn loại CD, mua kèm và đặt hàng chỉ trong 1 phút." },
  { keys: ["gui-file", "nop-file"], href: "/gui-file", title: "Gửi file", verb: "Gửi file", desc: "Gửi ảnh in và link nhạc cho đơn của bạn." },
  { keys: ["ve-chung-toi", "san-pham", "danh-gia"], href: "/ve-chung-toi", title: "Đánh giá", verb: "Khoe thành quả", desc: "Xem những chiếc CD tiệm đã làm cùng khách." },
  { keys: ["lien-he"], href: "/lien-he", title: "Liên hệ", verb: "Trò chuyện", desc: "Cần gì cứ nhắn tiệm qua Zalo nhé!" },
];

const plain = (s: string) => s.replace(/\[|\]/g, "");

// Chữ trong [ngoặc vuông] được tô "bút dạ" hồng
function Marker({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]]+\])/g).filter(Boolean).map((p, i) =>
        p.startsWith("[") ? (
          <span key={i} className="relative whitespace-nowrap">
            <span aria-hidden className="absolute inset-x-[-4px] bottom-[0.08em] h-[0.45em] -skew-x-6 rounded-[4px] bg-[#ff5fa2]/35" />
            <span className="relative">{p.slice(1, -1)}</span>
          </span>
        ) : <span key={i}>{p}</span>,
      )}
    </>
  );
}

// Vòng tròn vẽ tay có số bước, tô màu ô trong Admin
function StepBadge({ n, fill }: { n: number; fill: string }) {
  return (
    <span className="relative grid h-14 w-14 shrink-0 place-items-center" style={HAND}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <path d="M52 7 C78 6 95 24 93 51 C91 78 72 94 47 93 C21 92 5 73 7 47 C9 22 29 8 56 9" fill={fill} stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <path d="M30 12 C40 8 55 7 64 10" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity=".5" />
      </svg>
      <span className="relative text-[24px] leading-none text-[#18181b]">{n}</span>
    </span>
  );
}

// Mũi tên vẽ tay
function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} aria-hidden fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6 C18 18 26 28 30 46" />
      <path d="M20 40 C24 43 28 46 31 49 C33 44 36 40 40 36" />
    </svg>
  );
}

export default function HomeV3({ home, options, settings }: HomeVariantProps) {
  const custom = Array.isArray(settings.steps) ? (settings.steps as { verb?: string; desc?: string }[]) : [];
  const used = new Set<number>();
  const steps = JOURNEY.map((j, i) => {
    const idx = options.findIndex((o, k) => !used.has(k) && j.keys.some((key) => (o.href || "").includes(key)));
    if (idx >= 0) used.add(idx);
    const o: HomeOption | undefined = options[idx];
    return {
      n: i + 1,
      href: o?.href || j.href,
      title: o?.title || j.title,
      fill: o && !/^#?f{6}$/i.test(o.bg) ? o.bg : i % 2 ? "#f4f4f5" : "#fff0f6",
      verb: custom[i]?.verb || j.verb,
      desc: custom[i]?.desc || j.desc,
    };
  });
  const kicker = (settings.kicker as string) || "Tiệm In Taylana";
  const cta = (settings.cta as string) || "Bắt đầu hành trình";

  return (
    <div className="relative flex-1 overflow-hidden bg-[#fcfcfb] font-sans text-[#18181b]">
      {/* nền giấy kẻ chấm */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.5] [background-image:radial-gradient(#e5e5e7_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* ---------- Mở đầu ---------- */}
      <section className="relative mx-auto max-w-[960px] px-4 pb-8 pt-12 text-center sm:pt-16">
        <p className="inline-flex -rotate-2 items-center gap-2 rounded-full border-2 border-[#18181b] bg-white px-4 py-1 text-[16px]" style={HAND}>
          {kicker} <span className="text-[#ff5fa2]">✿</span>
        </p>
        <h1 className="mx-auto mt-6 max-w-[760px] font-sans text-[32px] font-bold normal-case leading-[1.15] tracking-[-0.02em] text-[#18181b] sm:text-[48px]">
          {plain(home.banner_title) || "CD của bạn, theo cách của bạn"}
        </h1>
        {/* gạch chân vẽ tay */}
        <svg viewBox="0 0 300 20" className="mx-auto mt-2 h-4 w-56 sm:w-72" aria-hidden fill="none" stroke={PINK} strokeWidth="5" strokeLinecap="round">
          <path d="M4 13 C60 4 120 6 170 9 C210 11 250 8 296 6" />
        </svg>
        {home.banner_subtitle && <p className="mx-auto mt-4 max-w-[560px] text-[16px] leading-relaxed text-[#52525b]">{home.banner_subtitle}</p>}
        <p className="mt-8 inline-flex items-center gap-1 text-[18px] text-[#71717a]" style={HAND}>
          6 bước là có CD của riêng bạn <Arrow className="h-10 w-10 translate-y-2" />
        </p>
      </section>

      {/* ---------- Hành trình 6 bước ---------- */}
      <section className="relative mx-auto max-w-[960px] px-4 pb-16">
        {/* đường nối vẽ tay chạy dọc: điện thoại bên trái, máy tính ở giữa */}
        <svg aria-hidden className="absolute bottom-24 left-[44px] top-4 w-5 lg:left-1/2 lg:-translate-x-1/2" viewBox="0 0 20 600" preserveAspectRatio="none" fill="none">
          <path d="M10 0 C2 50 18 100 10 150 C2 200 18 250 10 300 C2 350 18 400 10 450 C2 500 18 550 10 600"
            stroke={INK} strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>

        <ol className="relative flex flex-col gap-8 lg:gap-6">
          {steps.map((s, i) => {
            const right = i % 2 === 1;
            return (
              <li key={s.n} className="grid grid-cols-[56px_1fr] items-center gap-4 lg:grid-cols-[1fr_56px_1fr] lg:gap-8">
                <div className={`${right ? "lg:col-start-3" : "lg:col-start-1"} col-start-2 row-start-1`}>
                  <Link href={s.href}
                    className={`group block rounded-[255px_15px_225px_15px/15px_225px_15px_255px] border-2 border-[#18181b] bg-white p-5 shadow-[4px_5px_0_#18181b] transition-transform duration-200 hover:-translate-y-1 hover:rotate-0 hover:shadow-[6px_8px_0_#ff5fa2] ${right ? "rotate-[0.8deg]" : "-rotate-[0.8deg]"}`}>
                    <p className="text-[16px] text-[#ff5fa2]" style={HAND}>Bước {s.n} · {s.verb}</p>
                    <h2 className="mt-1 font-sans text-[22px] font-bold normal-case leading-tight tracking-[-0.01em] text-[#18181b]"><Marker text={s.title} /></h2>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-[#71717a]">{s.desc}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-[16px] text-[#18181b] group-hover:text-[#ff5fa2]" style={HAND}>
                      Đi thôi <span className="transition-transform group-hover:translate-x-1">→</span>
                    </span>
                  </Link>
                </div>
                <div className="col-start-1 row-start-1 flex justify-center lg:col-start-2"><StepBadge n={s.n} fill={s.fill} /></div>
              </li>
            );
          })}
        </ol>

        {/* ---------- Kết ---------- */}
        <div className="relative mt-12 text-center">
          <p className="text-[22px] text-[#18181b]" style={HAND}>Sẵn sàng chưa? <span className="text-[#ff5fa2]">♡</span></p>
          <Link href={home.btn1_href || "/dat-don"}
            className="mt-4 inline-flex h-12 items-center rounded-[255px_15px_225px_15px/15px_225px_15px_255px] border-2 border-[#18181b] bg-[#ff5fa2] px-8 text-[16px] font-semibold text-white shadow-[4px_5px_0_#18181b] transition-transform hover:-translate-y-0.5">
            {home.btn1_label || cta}
          </Link>
        </div>
      </section>
    </div>
  );
}
