/* Hoạ tiết vẽ tay đơn giản bằng SVG — nét bo tròn, hơi "run tay" cho cute. */
type P = { className?: string; style?: React.CSSProperties };

const stroke = {
  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function CdIcon({ className, style }: P) {
  return (
    <svg viewBox="0 0 64 64" className={className} style={style} aria-hidden>
      <circle cx="32" cy="32" r="27" fill="#fff" {...stroke} />
      <path d="M32 9a23 23 0 0 1 21 14" fill="none" {...stroke} stroke="var(--color-pink-400)" strokeWidth={3.5} />
      <path d="M13 42a23 23 0 0 0 12 11" fill="none" {...stroke} stroke="var(--color-matcha-400)" strokeWidth={3.5} />
      <path d="M44 16a19 19 0 0 1 4 6" fill="none" {...stroke} stroke="var(--color-butter-200)" strokeWidth={3} />
      <circle cx="32" cy="32" r="9" fill="var(--color-pink-200)" {...stroke} />
      <circle cx="32" cy="32" r="3" fill="var(--color-cream-100)" {...stroke} />
    </svg>
  );
}

export function NoteIcon({ className, style }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} style={style} aria-hidden>
      <path d="M18 34V10.5l20-4.5v23" fill="none" {...stroke} />
      <path d="M18 15l20-4.5" fill="none" {...stroke} />
      <ellipse cx="13" cy="35" rx="6" ry="4.6" transform="rotate(-18 13 35)" fill="currentColor" />
      <ellipse cx="33" cy="30" rx="6" ry="4.6" transform="rotate(-18 33 30)" fill="currentColor" />
    </svg>
  );
}

export function StarIcon({ className, style }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} style={style} aria-hidden>
      <path
        d="M24 5.5c1.6 5.3 3.4 9.4 5.6 11.3 2.4 1.9 7.2 2.7 12.9 3.3-4.3 3.3-8.6 6.3-9.6 9.2-1 3 .6 7.6 2.3 13.2-4.7-3.3-8.8-5.9-11.4-5.9s-6.8 2.6-11.4 5.9c1.7-5.6 3.3-10.2 2.3-13.2-1-2.9-5.3-5.9-9.6-9.2 5.7-.6 10.5-1.4 12.9-3.3 2.2-1.9 4-6 5.5-11.3z"
        fill="currentColor"
        {...stroke}
        stroke="var(--color-cocoa-700)"
        strokeWidth={2}
      />
    </svg>
  );
}

export function SparkleIcon({ className, style }: P) {
  return (
    <svg viewBox="0 0 32 32" className={className} style={style} aria-hidden>
      <path d="M16 3c1 6.5 3 9 10 13-7 3.5-9 6.5-10 13-1-6.5-3-9.5-10-13 7-4 9-6.5 10-13z" fill="currentColor" />
    </svg>
  );
}

export function FlowerIcon({ className, style }: P) {
  const petals = [0, 72, 144, 216, 288];
  return (
    <svg viewBox="0 0 48 48" className={className} style={style} aria-hidden>
      {petals.map((r) => (
        <ellipse
          key={r}
          cx="24"
          cy="13.5"
          rx="7.2"
          ry="9.5"
          transform={`rotate(${r} 24 24)`}
          fill="currentColor"
          {...stroke}
          stroke="var(--color-cocoa-700)"
          strokeWidth={2}
        />
      ))}
      <circle cx="24" cy="24" r="5.5" fill="var(--color-butter-200)" {...stroke} stroke="var(--color-cocoa-700)" strokeWidth={2} />
    </svg>
  );
}

export function HeartIcon({ className, style }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} style={style} aria-hidden>
      <path
        d="M24 41C10 32 5 24.5 5.5 17.5 6 11 11 7 16.5 7.5c3.5.3 6 2.4 7.5 5.5 1.5-3.1 4-5.2 7.5-5.5C37 7 42 11 42.5 17.5 43 24.5 38 32 24 41z"
        fill="currentColor"
        {...stroke}
        stroke="var(--color-cocoa-700)"
        strokeWidth={2}
      />
    </svg>
  );
}

/* ----- Biểu tượng cho 6 dịch vụ ----- */

export function BagIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M9 17h30l-2.5 23.5h-25z" fill="#fff" {...stroke} />
      <path d="M17 20v-6a7 7 0 0 1 14 0v6" fill="none" {...stroke} />
      <path d="M20 30.5c1.5 2 6.5 2 8 0" fill="none" {...stroke} />
    </svg>
  );
}

export function BookIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M24 12c-4-3-10-4-17-3v28c7-1 13 0 17 3 4-3 10-4 17-3V9c-7-1-13 0-17 3z" fill="#fff" {...stroke} />
      <path d="M24 12v28" fill="none" {...stroke} />
      <path d="M12 17c3-.3 5.5 0 8 1M12 23c3-.3 5.5 0 8 1M28 18c2.5-1 5-1.3 8-1" fill="none" {...stroke} strokeWidth={2} />
    </svg>
  );
}

export function BrushIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M38 7c2 1.5 3 3 3 4L25 29l-5-4L35 8c1-1 2-1.5 3-1z" fill="#fff" {...stroke} />
      <path d="M20 25c-5 0-8 3-8.5 7.5C11 36 9 38 6.5 39c6 2.5 15 1 17.5-6.5.6-2-1-5.5-4-7.5z" fill="var(--color-pink-300)" {...stroke} />
    </svg>
  );
}

export function FilmIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect x="14" y="4" width="20" height="40" rx="3" fill="#fff" {...stroke} />
      <rect x="18" y="8.5" width="12" height="8.5" rx="1.5" fill="var(--color-pink-200)" {...stroke} strokeWidth={2} />
      <rect x="18" y="19.8" width="12" height="8.5" rx="1.5" fill="var(--color-matcha-200)" {...stroke} strokeWidth={2} />
      <rect x="18" y="31" width="12" height="8.5" rx="1.5" fill="var(--color-butter-200)" {...stroke} strokeWidth={2} />
    </svg>
  );
}

export function UploadIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M14 36c-6 0-9-4-9-8.5 0-4.5 3.5-8 8-8 1-6 5.5-10 11-10s10 4 11 9.5c4.5.2 8 3.8 8 8.5S39.5 36 34 36" fill="#fff" {...stroke} />
      <path d="M24 41V24M17.5 30l6.5-6.5 6.5 6.5" fill="none" {...stroke} />
    </svg>
  );
}

export function GalleryIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect x="6" y="9" width="36" height="30" rx="4" fill="#fff" {...stroke} />
      <path d="M8 35l10-11 7 7 5-5 10 9" fill="var(--color-matcha-200)" {...stroke} />
      <circle cx="31" cy="18" r="3.5" fill="var(--color-butter-200)" {...stroke} strokeWidth={2} />
    </svg>
  );
}
