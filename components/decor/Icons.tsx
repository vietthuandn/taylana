/* Icon nét đậm đơn sắc (màu theo currentColor). */
type P = { className?: string };
const st = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function CdIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <circle cx="24" cy="24" r="19" {...st} />
      <circle cx="24" cy="24" r="6" {...st} />
      <path d="M24 9a15 15 0 0 1 13 8" {...st} strokeWidth={2.5} />
    </svg>
  );
}
export function BagIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M9 17h30l-2.5 23h-25z" {...st} />
      <path d="M17 21v-6a7 7 0 0 1 14 0v6" {...st} />
    </svg>
  );
}
export function BookIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M24 13c-4-3-10-4-17-3v27c7-1 13 0 17 3 4-3 10-4 17-3V10c-7-1-13 0-17 3z" {...st} />
      <path d="M24 13v27" {...st} />
    </svg>
  );
}
export function BrushIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M37 7l4 4-17 17-4-4z" {...st} />
      <path d="M20 24c-5 0-8 3-8.5 7.5-.5 3.5-2.5 5.5-5 6.5 6 2.5 15 1 17.5-6.5" {...st} />
    </svg>
  );
}
export function FilmIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect x="14" y="4" width="20" height="40" rx="3" {...st} />
      <path d="M18 16h12M18 28h12" {...st} />
    </svg>
  );
}
export function UploadIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M14 36c-6 0-9-4-9-8.5S8.5 19.5 13 19.5c1-6 5.5-10 11-10s10 4 11 9.5c4.5.2 8 3.8 8 8.5S39.5 36 34 36" {...st} />
      <path d="M24 41V24M17.5 30l6.5-6.5 6.5 6.5" {...st} />
    </svg>
  );
}
export function GalleryIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect x="6" y="9" width="36" height="30" rx="5" {...st} />
      <path d="M8 34l10-10 7 7 5-5 10 9" {...st} />
      <circle cx="31" cy="18" r="3" {...st} />
    </svg>
  );
}
export function SearchIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth={2.2} />
      <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}
export function ChatIcon({ className }: P) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M8 12c0-2.5 2-4 4.5-4h23c2.5 0 4.5 1.5 4.5 4v16c0 2.5-2 4-4.5 4H22l-9 7v-7h-.5C10 32 8 30.5 8 28z" {...st} />
      <path d="M17 20h.01M24 20h.01M31 20h.01" {...st} strokeWidth={4} />
    </svg>
  );
}
