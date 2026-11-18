/* Mẫu 4 · Tem Vui — 6 sticker tròn kiểu "nhãn dán khen thưởng": chữ uốn cong theo vòng tròn,
   giữa là 1 con vật / trái cây vẽ SVG hợp với từng mục menu.
   Dữ liệu chung: Admin → Trang chủ (tiêu đề banner, tên + link 6 ô). Ô nào có ẢNH trong Admin thì ảnh đó thay cho hình vẽ.
   Dữ liệu riêng (variant_settings["v4-tem-vui"], không bắt buộc):
     { kicker?: string, stickers?: { tag?: string; color?: string; icon?: string }[] }
       tag = dòng chữ cong phía dưới · color = màu nền sticker · icon = link ảnh/SVG icon tự thêm
   Mẫu tự chứa toàn bộ giao diện — không import mẫu khác. */
import "@fontsource/itim/400.css";
import Link from "next/link";
import { FEATURE_UPLOAD_FILES } from "@/lib/features";
import type { HomeVariantProps } from "@/lib/homeData";

const FUN = { fontFamily: '"Itim", "Pangolin", "Comic Sans MS", cursive' } as const;
type Art = "owl" | "cat" | "strawberry" | "frog" | "avocado" | "grape";
type Def = { keys: string[]; href: string; title: string; tag: string; bg: string; ink: string; art: Art };

// Mỗi mục menu ↔ 1 nhân vật (nhận diện ô trong Admin theo link)
const STICKERS: Def[] = [
  { keys: ["huong-dan"], href: "/huong-dan", title: "Hướng dẫn", tag: "Cú chỉ bạn nè!", bg: "#c2416b", ink: "#ffffff", art: "owl" },
  { keys: ["thiet-ke", "custom-cd", "tu-thiet-ke"], href: "/thiet-ke", title: "Thiết kế", tag: "Mèo-tuyệt vời!", bg: "#fbf3e6", ink: "#e6457a", art: "cat" },
  { keys: ["dat-don"], href: "/dat-don", title: "Đặt đơn", tag: "Dâu-tiên là chốt!", bg: "#ffd166", ink: "#3f6b3a", art: "strawberry" },
  { keys: FEATURE_UPLOAD_FILES ? ["gui-file", "nop-file"] : ["mockup", "gui-file", "nop-file"], href: FEATURE_UPLOAD_FILES ? "/gui-file" : "/thiet-ke/mockup", title: FEATURE_UPLOAD_FILES ? "Gửi file" : "Lên mockup", tag: "Nhảy phát tới liền!", bg: "#3fa7f0", ink: "#173a7a", art: "frog" },
  { keys: ["ve-chung-toi", "san-pham", "danh-gia"], href: "/ve-chung-toi", title: "Đánh giá", tag: "Bơ-ra-vô!", bg: "#82d39a", ink: "#ffffff", art: "avocado" },
  { keys: ["lien-he"], href: "/lien-he", title: "Liên hệ", tag: "Nho nhắn tiệm nha!", bg: "#4a7bd0", ink: "#ffffff", art: "grape" },
];

const plain = (s: string) => s.replace(/\[|\]/g, "");
// cỡ chữ vừa cung tròn (cung trên ~150px, cung dưới ~165px trong hệ 200)
const fit = (t: string, arc: number, max: number) => Math.min(max, arc / (Math.max(1, t.length) * 0.58));

// ---------- Nhân vật (vẽ trong ô 200×200, tâm ~ (100,104)) ----------
const Eye = ({ x, y, r = 7 }: { x: number; y: number; r?: number }) => (
  <g><circle cx={x} cy={y} r={r} fill="#fff" stroke="#1f1f1f" strokeWidth="2" /><circle cx={x + 1.5} cy={y + 1} r={r * 0.5} fill="#1f1f1f" /><circle cx={x + 3} cy={y - 1.5} r={r * 0.18} fill="#fff" /></g>
);
const Cheek = ({ x, y }: { x: number; y: number }) => <ellipse cx={x} cy={y} rx="5" ry="3.2" fill="#ff8fa8" opacity=".8" />;

function Character({ art }: { art: Art }) {
  switch (art) {
    case "owl":
      return (
        <g>
          <path d="M100 58 C128 58 140 80 140 108 C140 138 124 152 100 152 C76 152 60 138 60 108 C60 80 72 58 100 58Z" fill="#a0673f" />
          <path d="M70 66 L64 48 L84 60Z M130 66 L136 48 L116 60Z" fill="#a0673f" />
          <ellipse cx="100" cy="124" rx="24" ry="22" fill="#f2d3a6" />
          <path d="M88 116 q4 3 8 0 M100 122 q4 3 8 0 M90 130 q4 3 8 0 M104 136 q4 3 8 0" stroke="#c99a64" strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="86" cy="90" r="15" fill="#fff6e8" /><circle cx="114" cy="90" r="15" fill="#fff6e8" />
          <Eye x={86} y={90} r={8} /><Eye x={114} y={90} r={8} />
          <path d="M100 98 l-6 6 h12z" fill="#ff9f1c" stroke="#1f1f1f" strokeWidth="1.5" strokeLinejoin="round" />
          {/* sách */}
          <path d="M70 150 L100 143 L130 150 L130 160 L100 154 L70 160Z" fill="#fff" stroke="#1f1f1f" strokeWidth="2" strokeLinejoin="round" />
          <path d="M100 143 V154" stroke="#1f1f1f" strokeWidth="2" />
        </g>
      );
    case "cat":
      return (
        <g>
          <path d="M70 82 L66 52 L90 70Z M130 82 L134 52 L110 70Z" fill="#f59a3e" stroke="#1f1f1f" strokeWidth="2" strokeLinejoin="round" />
          <path d="M71 62 l2 10 M129 62 l-2 10" stroke="#ff8fa8" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="100" cy="104" rx="40" ry="34" fill="#f59a3e" stroke="#1f1f1f" strokeWidth="2" />
          <path d="M84 76 l3 9 M100 72 v10 M116 76 l-3 9" stroke="#c96a1c" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="100" cy="118" rx="18" ry="12" fill="#fff3e3" />
          <Eye x={86} y={100} /><Eye x={114} y={100} />
          <path d="M96 110 h8 l-4 4z" fill="#ff6f91" />
          <path d="M100 114 q-4 6 -9 3 M100 114 q4 6 9 3" stroke="#1f1f1f" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <path d="M60 108 h16 M60 116 l16 -3 M140 108 h-16 M140 116 l-16 -3" stroke="#1f1f1f" strokeWidth="1.5" strokeLinecap="round" />
          <Cheek x={76} y={114} /><Cheek x={124} y={114} />
          {/* cọ vẽ */}
          <g transform="rotate(35 140 140)"><rect x="136" y="116" width="8" height="38" rx="3" fill="#4a7bd0" stroke="#1f1f1f" strokeWidth="1.6" /><path d="M136 116 q4 -14 8 0z" fill="#e6457a" stroke="#1f1f1f" strokeWidth="1.6" /></g>
        </g>
      );
    case "strawberry":
      return (
        <g>
          <path d="M100 152 C72 140 58 112 62 92 C66 74 84 70 100 76 C116 70 134 74 138 92 C142 112 128 140 100 152Z" fill="#e5484d" stroke="#1f1f1f" strokeWidth="2" />
          <path d="M100 78 C90 62 76 64 72 70 C84 70 90 76 94 80 M100 78 C110 62 124 64 128 70 C116 70 110 76 106 80 M100 80 C98 66 102 58 108 54" fill="#5fa85a" stroke="#1f1f1f" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {[[78, 100], [92, 128], [120, 104], [110, 132], [84, 118], [124, 120], [100, 140]].map(([x, y]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx="1.6" ry="2.6" fill="#ffe08a" />)}
          <Eye x={88} y={104} /><Eye x={112} y={104} />
          <path d="M94 118 q6 6 12 0" stroke="#1f1f1f" strokeWidth="2" fill="none" strokeLinecap="round" />
          <Cheek x={80} y={116} /><Cheek x={120} y={116} />
        </g>
      );
    case "frog":
      return (
        <g>
          <ellipse cx="100" cy="128" rx="40" ry="26" fill="#8fd16a" stroke="#1f1f1f" strokeWidth="2" />
          <ellipse cx="100" cy="102" rx="38" ry="26" fill="#8fd16a" stroke="#1f1f1f" strokeWidth="2" />
          <circle cx="80" cy="80" r="14" fill="#8fd16a" stroke="#1f1f1f" strokeWidth="2" /><circle cx="120" cy="80" r="14" fill="#8fd16a" stroke="#1f1f1f" strokeWidth="2" />
          <Eye x={80} y={80} r={8} /><Eye x={120} y={80} r={8} />
          <path d="M80 106 q20 14 40 0" stroke="#1f1f1f" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <Cheek x={72} y={104} /><Cheek x={128} y={104} />
          {/* phong bì gửi file */}
          <g transform="rotate(-6 100 136)">
            <rect x="82" y="124" width="36" height="24" rx="3" fill="#fff" stroke="#1f1f1f" strokeWidth="2" />
            <path d="M82 126 l18 12 l18 -12" fill="none" stroke="#1f1f1f" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="112" cy="142" r="3.5" fill="#e6457a" />
          </g>
        </g>
      );
    case "avocado":
      return (
        <g>
          <path d="M100 56 C118 56 124 76 132 94 C142 116 136 152 100 152 C64 152 58 116 68 94 C76 76 82 56 100 56Z" fill="#4f8f3a" stroke="#1f1f1f" strokeWidth="2" />
          <path d="M100 64 C114 64 118 82 125 97 C133 116 128 144 100 144 C72 144 67 116 75 97 C82 82 86 64 100 64Z" fill="#cfe58a" />
          <circle cx="100" cy="122" r="17" fill="#8a5a36" stroke="#1f1f1f" strokeWidth="2" />
          <circle cx="94" cy="116" r="4" fill="#b07a4f" />
          <Eye x={90} y={92} r={6.5} /><Eye x={110} y={92} r={6.5} />
          <path d="M95 101 q5 5 10 0" stroke="#1f1f1f" strokeWidth="2" fill="none" strokeLinecap="round" />
          <Cheek x={82} y={101} /><Cheek x={118} y={101} />
        </g>
      );
    case "grape":
      return (
        <g>
          <path d="M102 62 C104 52 112 48 120 50 C118 58 110 62 102 62Z" fill="#5fa85a" stroke="#1f1f1f" strokeWidth="1.8" />
          <path d="M100 66 V56" stroke="#7a5230" strokeWidth="3" strokeLinecap="round" />
          {[[78, 80], [100, 76], [122, 80], [68, 102], [90, 100], [112, 100], [132, 102], [80, 122], [102, 122], [122, 122], [92, 142], [112, 142]].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="13" fill="#8b5cf6" stroke="#1f1f1f" strokeWidth="1.8" />
          ))}
          {[[74, 76], [96, 72], [64, 98], [86, 96]].map(([x, y]) => <circle key={`h${x}${y}`} cx={x} cy={y} r="3" fill="#fff" opacity=".55" />)}
          <Eye x={90} y={102} r={6.5} /><Eye x={112} y={102} r={6.5} />
          <path d="M96 114 q5 5 10 0" stroke="#1f1f1f" strokeWidth="2" fill="none" strokeLinecap="round" />
          <Cheek x={82} y={114} /><Cheek x={120} y={114} />
          {/* bong bóng chat */}
          <path d="M134 60 h22 a6 6 0 0 1 6 6 v10 a6 6 0 0 1 -6 6 h-12 l-6 6 v-6 h-4 a6 6 0 0 1 -6 -6 v-10 a6 6 0 0 1 6 -6z" fill="#fff" stroke="#1f1f1f" strokeWidth="1.8" />
          <path d="M145 76 c-4 -3 -6 -5 -6 -7 a3 3 0 0 1 6 -1 a3 3 0 0 1 6 1 c0 2 -2 4 -6 7z" fill="#e6457a" />
        </g>
      );
  }
}

// confetti nhỏ trang trí
function Confetti({ ink }: { ink: string }) {
  return (
    <g opacity=".85">
      <path d="M44 120 l6 -4 l2 7z" fill={ink} opacity=".6" />
      <rect x="150" y="128" width="7" height="7" rx="1.5" transform="rotate(20 153 131)" fill="#ffb347" />
      <path d="M48 84 l2 5 l5 1 l-4 3 l1 5 l-4 -3 l-4 3 l1 -5 l-4 -3 l5 -1z" fill="#ffe08a" />
      <path d="M152 92 c4 -6 10 0 4 4 c-6 4 0 10 4 6" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round" opacity=".7" />
    </g>
  );
}

function Sticker({ i, title, tag, href, bg, ink, art, icon }: { i: number; title: string; tag: string; href: string; bg: string; ink: string; art: Art; icon?: string | null }) {
  const id = `v4s${i}`;
  const tilt = [-4, 3, -2, 4, -3, 2][i % 6];
  return (
    <Link href={href} aria-label={title}
      className="group block aspect-square w-full max-w-[300px] justify-self-center transition-transform duration-300 rotate-[var(--tilt)] hover:-translate-y-1.5 hover:rotate-0 focus-visible:outline-none"
      style={{ "--tilt": `${tilt}deg` } as React.CSSProperties}>
      <svg viewBox="0 0 200 200" className="h-full w-full drop-shadow-[0_8px_14px_rgba(0,0,0,0.14)] transition-[filter] group-hover:drop-shadow-[0_14px_20px_rgba(0,0,0,0.2)]" role="img" aria-hidden>
        <defs>
          <path id={`${id}t`} d="M36 100 A64 64 0 0 1 164 100" />
          <path id={`${id}b`} d="M24 100 A76 76 0 0 0 176 100" />
          <clipPath id={`${id}c`}><circle cx="100" cy="104" r="46" /></clipPath>
        </defs>
        {/* viền trắng kiểu nhãn dán */}
        <circle cx="100" cy="100" r="99" fill="#fff" />
        <circle cx="100" cy="100" r="94" fill={bg} />
        <Confetti ink={ink} />
        {icon ? (
          <g clipPath={`url(#${id}c)`}>
            <image href={icon} x="54" y="58" width="92" height="92" preserveAspectRatio="xMidYMid slice" />
          </g>
        ) : (
          <g transform="translate(100 104) scale(0.78) translate(-100 -104)">
            <Character art={art} />
          </g>
        )}
        <text fill={ink} style={{ ...FUN, fontSize: fit(title, 150, 26), letterSpacing: "0.04em" }} textAnchor="middle" fontWeight="700">
          <textPath href={`#${id}t`} startOffset="50%">{title.toUpperCase()}</textPath>
        </text>
        <text fill={ink} style={{ ...FUN, fontSize: fit(tag, 165, 19), letterSpacing: "0.03em" }} textAnchor="middle" dominantBaseline="hanging">
          <textPath href={`#${id}b`} startOffset="50%">{tag.toUpperCase()}</textPath>
        </text>
      </svg>
    </Link>
  );
}

export default function HomeV4({ home, options, settings }: HomeVariantProps) {
  const custom = Array.isArray(settings.stickers) ? (settings.stickers as { tag?: string; color?: string; icon?: string }[]) : [];
  const used = new Set<number>();
  const items = STICKERS.map((d, i) => {
    const idx = options.findIndex((o, k) => !used.has(k) && d.keys.some((key) => (o.href || "").includes(key)));
    if (idx >= 0) used.add(idx);
    const o = options[idx];
    return {
      ...d,
      href: o?.href || d.href,
      title: plain(o?.title || d.title),
      tag: custom[i]?.tag || d.tag,
      bg: custom[i]?.color || d.bg,
      icon: custom[i]?.icon || o?.image_url || null, // icon tự thêm → ảnh ô trong Admin → hình vẽ có sẵn
    };
  });
  const kicker = (settings.kicker as string) || "Tiệm In Taylana";

  return (
    <div className="relative flex-1 overflow-hidden bg-[#efeff1] font-sans text-[#18181b]">
      <section className="relative mx-auto max-w-[1040px] px-4 pb-6 pt-10 text-center sm:pt-14">
        <p className="inline-flex -rotate-2 items-center rounded-full bg-white px-4 py-1 text-[16px] text-[#c2416b] shadow-sm" style={FUN}>{kicker} ★</p>
        <h1 className="mx-auto mt-5 max-w-[760px] font-sans text-[30px] font-bold normal-case leading-[1.15] tracking-[-0.02em] text-[#18181b] sm:text-[44px]">
          {plain(home.banner_title) || "CD của bạn, theo cách của bạn"}
        </h1>
        {home.banner_subtitle && <p className="mx-auto mt-3 max-w-[560px] text-[15px] leading-relaxed text-[#52525b]">{home.banner_subtitle}</p>}
      </section>

      <section className="relative mx-auto grid max-w-[1040px] grid-cols-2 gap-x-4 gap-y-6 px-4 pb-16 sm:gap-x-10 sm:gap-y-10 lg:grid-cols-3">
        {items.map((s, i) => <Sticker key={s.art} i={i} {...s} />)}
      </section>
    </div>
  );
}
