/* Hoạ tiết & khung hình tự vẽ (SVG/CSS nhẹ). */

// ---- Tạo đường viền lượn sóng trong hệ toạ độ 0–1 (objectBoundingBox) ----
function wavePath(kind: "flower" | "cloud" | "stamp8" | "petal") {
  const pts: string[] = [];
  const N = 360;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    let x: number, y: number;
    if (kind === "flower") {
      const r = 0.5 * (0.92 + 0.08 * Math.cos(10 * t));
      x = 0.5 + r * Math.cos(t);
      y = 0.5 + r * Math.sin(t);
    } else if (kind === "stamp8" || kind === "petal") {
      // hình vuông có mép lượn tròn như con dấu: 8 cánh (icon) hoặc 16 cánh (khung ảnh banner)
      const lobes = kind === "stamp8" ? 8 : 16;
      const amp = kind === "stamp8" ? 0.085 : 0.045;
      const p = 3.2;
      const c = Math.cos(t), s = Math.sin(t);
      const k = 1 - amp * (1 - Math.cos(lobes * t)) / 2;
      x = 0.5 + 0.5 * k * Math.sign(c) * Math.abs(c) ** (2 / p);
      y = 0.5 + 0.5 * k * Math.sign(s) * Math.abs(s) ** (2 / p);
    } else {
      // hình vuông bo tròn có mép gợn sóng đều như đám mây
      const p = 3.4;
      const c = Math.cos(t), s = Math.sin(t);
      const k = 1 - 0.028 * (1 + Math.cos(28 * t)) / 2;
      x = 0.5 + 0.5 * k * Math.sign(c) * Math.abs(c) ** (2 / p);
      y = 0.5 + 0.5 * k * Math.sign(s) * Math.abs(s) ** (2 / p);
    }
    pts.push(`${x.toFixed(4)} ${y.toFixed(4)}`);
  }
  return `M${pts.join("L")}Z`;
}
const FLOWER = wavePath("flower");
const CLOUD = wavePath("cloud");
const STAMP8 = wavePath("stamp8");
const PETAL = wavePath("petal");

// Đặt 1 lần trong layout gốc: định nghĩa các khung cắt dùng bằng CSS clip-path
export function ClipDefs() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        <clipPath id="clip-flower" clipPathUnits="objectBoundingBox"><path d={FLOWER} /></clipPath>
        <clipPath id="clip-cloud" clipPathUnits="objectBoundingBox"><path d={CLOUD} /></clipPath>
        <clipPath id="clip-petal" clipPathUnits="objectBoundingBox"><path d={PETAL} /></clipPath>
      </defs>
    </svg>
  );
}

const borderColors = { lime: "bg-lime-500", violet: "bg-violet-500", hot: "bg-hot-500", ink: "bg-ink-900" } as const;

// Khung ảnh lượn sóng có viền màu dày ~4px
export function WavyFrame({ shape = "cloud", border = "lime", className = "", children }: {
  shape?: "flower" | "cloud" | "petal"; border?: keyof typeof borderColors; className?: string; children: React.ReactNode;
}) {
  const clip = { clipPath: `url(#clip-${shape})` };
  return (
    <div className={`relative ${borderColors[border]} ${className}`} style={clip}>
      <div className="absolute inset-[4px] overflow-hidden bg-cream-50" style={clip}>{children}</div>
    </div>
  );
}

// Bông hoa 4 cánh làm nền cho icon
export function FlowerBadge({ color = "lime", fillColor, className = "", children }: { color?: "lime" | "violet" | "hot"; fillColor?: string; className?: string; children?: React.ReactNode }) {
  const fill = fillColor || { lime: "var(--color-lime-500)", violet: "var(--color-violet-500)", hot: "var(--color-hot-500)" }[color];
  return (
    <span className={`${/\babsolute\b/.test(className) ? "" : "relative"} inline-grid place-items-center ${className}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:rotate-45" aria-hidden>
        <g fill={fill}>
          <circle cx="50" cy="25" r="25" /><circle cx="75" cy="50" r="25" />
          <circle cx="50" cy="75" r="25" /><circle cx="25" cy="50" r="25" />
          <circle cx="50" cy="50" r="26" />
        </g>
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}

// Ngôi sao lấp lánh 4 cánh
export function Sparkle({ className = "", color = "hot" }: { className?: string; color?: "hot" | "white" | "lime" | "violet" | "ink" }) {
  const fill = { hot: "var(--color-hot-500)", white: "#fff", lime: "var(--color-lime-500)", violet: "var(--color-violet-500)", ink: "var(--color-ink-900)" }[color];
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path fill={fill} d="M50 0C54 34 66 46 100 50 66 54 54 66 50 100 46 66 34 54 0 50 34 46 46 34 50 0Z" />
    </svg>
  );
}

// Đĩa CD: vòng tròn có lỗ giữa, ánh cầu vồng nhẹ (CSS thuần)
export function CdDisc({ className = "", spin = false }: { className?: string; spin?: boolean }) {
  return (
    <div aria-hidden className={`${/\babsolute\b/.test(className) ? "" : "relative"} aspect-square rounded-full ${spin ? "animate-spin-slow" : ""} ${className}`}
      style={{
        background:
          "radial-gradient(circle, transparent 0 13%, rgba(255,255,255,.95) 13.5% 16%, rgba(20,20,20,.12) 16.5% 17%, transparent 17.5% 33%, rgba(255,255,255,.55) 33.5% 34.5%, transparent 35%)," +
          "conic-gradient(from 210deg, #ececf2, #ffd3e8, #e4f5a8, #cfe6ff, #e2dbff, #ececf2, #fff0bf, #ffd3e8, #ececf2)",
        WebkitMask: "radial-gradient(circle, transparent 0 12%, #000 12.5%)",
        mask: "radial-gradient(circle, transparent 0 12%, #000 12.5%)",
        boxShadow: "inset 0 0 0 2px rgba(20,20,20,.85)",
      }}>
      <div className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(135deg, rgba(255,255,255,.7) 0%, transparent 35%, transparent 65%, rgba(255,255,255,.35) 100%)" }} />
    </div>
  );
}

// Đường kẻ cong lượn màu xanh chanh chạy sau nội dung (không cản bấm)
export function WavyLine() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 -z-10 h-full w-full" viewBox="0 0 100 1000" preserveAspectRatio="none">
      <path
        d="M-5 70 C 40 10, 70 190, 105 150 S 25 370, -5 430 S 75 640, 105 670 S 20 890, -5 950"
        fill="none" stroke="var(--color-lime-500)" strokeOpacity="0.75" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

// Hình vuông 8 cánh lượn tròn (như con dấu) làm nền cho icon
export function StampBadge({ color = "lime", fillColor, className = "", children }: { color?: "lime" | "violet" | "hot"; fillColor?: string; className?: string; children?: React.ReactNode }) {
  const fill = fillColor || { lime: "var(--color-lime-500)", violet: "var(--color-violet-500)", hot: "var(--color-hot-500)" }[color];
  return (
    <span className={`${/\babsolute\b/.test(className) ? "" : "relative"} inline-grid place-items-center ${className}`}>
      <svg viewBox="0 0 1 1" className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:rotate-[22.5deg]" aria-hidden>
        <path d={STAMP8} fill={fill} />
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}

// Khung ảnh vuông cánh hoa tròn, ảnh phủ kín, viền màu mảnh (banner trang chủ)
export function PetalFrame({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const clip = { clipPath: "url(#clip-petal)" };
  return (
    <div className={`relative bg-ink-900 ${className}`} style={clip}>
      <div className="absolute inset-[2px] overflow-hidden bg-cream-50" style={clip}>{children}</div>
    </div>
  );
}
