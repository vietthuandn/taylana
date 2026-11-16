// Icon nhỏ 16px nét mảnh cho panel trình chỉnh
const paths: Record<string, React.ReactNode> = {
  image: <><rect x="2.5" y="3" width="11" height="10" rx="1.5" /><circle cx="6" cy="6.5" r="1.2" /><path d="M3 12l3.5-3.5 2.5 2.5 1.5-1.5L13 12" /></>,
  text: <path d="M3.5 4h9M8 4v9M6 13h4" />,
  sticker: <><path d="M13 8.5A5 5 0 1 1 7.5 3H11l2 2z" /><path d="M6 9.5s.8 1 2 1 2-1 2-1M6.3 6.8h.01M9.7 6.8h.01" /></>,
  up: <path d="M8 13V3M4 7l4-4 4 4" />,
  down: <path d="M8 3v10M4 9l4 4 4-4" />,
  trash: <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />,
  alignL: <path d="M3 4h10M3 7h6M3 10h10M3 13h6" />,
  alignC: <path d="M3 4h10M5 7h6M3 10h10M5 13h6" />,
  alignR: <path d="M3 4h10M7 7h6M3 10h10M7 13h6" />,
  lineHeight: <path d="M7 4h7M7 8h7M7 12h7M3.5 3v10M2 4.5l1.5-1.5L5 4.5M2 11.5L3.5 13 5 11.5" />,
  back: <path d="M10 3L5 8l5 5" />,
  copy: <><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" /><path d="M10.5 3.5v-.5A1 1 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1 1 0 0 0 3 10.5h.5" /></>,
  paste: <><rect x="3.5" y="3" width="9" height="11" rx="1.5" /><path d="M6 3V2h4v1M6 7h4M6 10h4" /></>,
  top: <path d="M3 2.5h10M8 14V5.5M4.5 9L8 5.5 11.5 9" />,
  bottom: <path d="M3 13.5h10M8 2v8.5M4.5 7L8 10.5 11.5 7" />,
  fit: <><rect x="2.5" y="3.5" width="11" height="9" rx="1" /><rect x="5" y="5.5" width="6" height="5" rx=".5" /></>,
  cover: <><rect x="2.5" y="3.5" width="11" height="9" rx="1" /><path d="M2.5 6.5h11M2.5 9.5h11" /></>,
  grid: <path d="M2.5 2.5h11v11h-11zM2.5 6h11M2.5 10h11M6 2.5v11M10 2.5v11" />,
  frame: <><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" strokeDasharray="2 1.6" /><path d="M8 5.5v5M5.5 8h5" /></>,
  user: <><circle cx="8" cy="5.5" r="2.6" /><path d="M3 13.5c.8-2.6 2.8-3.8 5-3.8s4.2 1.2 5 3.8" /></>,
};

export function Icon({ name, className = "" }: { name: keyof typeof paths | string; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {paths[name]}
    </svg>
  );
}
