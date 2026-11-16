// Sticker cute tự vẽ (SVG). Dùng trong Custom CD & Photostrip.
const S = 'stroke="#141414" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"';
const S5 = 'stroke="#141414" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"';
const wrap = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">${body}</svg>`;

const raw: Record<string, string> = {
  heart: wrap(`<path ${S} fill="#ff5fa2" d="M100 172C40 132 20 100 22 70 24 42 46 26 68 28c15 1 26 10 32 23 6-13 17-22 32-23 22-2 44 14 46 42 2 30-18 62-78 102z"/><ellipse cx="62" cy="62" rx="12" ry="8" fill="#fff" opacity=".7" transform="rotate(-30 62 62)"/>`),
  star: wrap(`<path ${S} fill="#ffe08a" d="M100 18l24 50 54 7-40 37 11 54-49-27-49 27 11-54-40-37 54-7z"/><circle cx="82" cy="104" r="6" fill="#141414"/><circle cx="118" cy="104" r="6" fill="#141414"/><path d="M88 122q12 10 24 0" fill="none" ${S5}/>`),
  flower: wrap(`${[0, 72, 144, 216, 288].map((r) => `<ellipse ${S} fill="#ffd9e3" cx="100" cy="52" rx="30" ry="38" transform="rotate(${r} 100 100)"/>`).join("")}<circle ${S} fill="#ffe08a" cx="100" cy="100" r="26"/>`),
  daisy: wrap(`${Array.from({ length: 10 }, (_, i) => `<ellipse ${S5} fill="#fff" cx="100" cy="50" rx="16" ry="34" transform="rotate(${i * 36} 100 100)"/>`).join("")}<circle ${S} fill="#ffcf5c" cx="100" cy="100" r="24"/>`),
  cd: wrap(`<circle ${S} fill="#eef0ff" cx="100" cy="100" r="80"/><path d="M100 34a66 66 0 0 1 60 40" fill="none" stroke="#ff5fa2" stroke-width="12" stroke-linecap="round"/><path d="M40 128a66 66 0 0 0 34 32" fill="none" stroke="#a6c37f" stroke-width="12" stroke-linecap="round"/><circle ${S} fill="#ffd9e3" cx="100" cy="100" r="26"/><circle ${S} fill="#fff" cx="100" cy="100" r="9"/>`),
  note: wrap(`<path ${S} fill="none" d="M76 146V52l80-18v94"/><path ${S} fill="none" d="M76 74l80-18"/><ellipse ${S} fill="#ff5fa2" cx="56" cy="148" rx="24" ry="18" transform="rotate(-18 56 148)"/><ellipse ${S} fill="#a6c37f" cx="136" cy="130" rx="24" ry="18" transform="rotate(-18 136 130)"/>`),
  cloud: wrap(`<path ${S} fill="#fff" d="M52 150c-24 0-36-16-36-34 0-19 15-33 34-32 4-26 26-44 52-42 22 2 38 17 43 36 23-1 41 15 41 37 0 20-16 35-38 35z"/><circle cx="80" cy="118" r="6" fill="#141414"/><circle cx="122" cy="118" r="6" fill="#141414"/><ellipse cx="66" cy="132" rx="10" ry="6" fill="#ffc2d4"/><ellipse cx="136" cy="132" rx="10" ry="6" fill="#ffc2d4"/><path d="M92 130q9 8 18 0" fill="none" ${S5}/>`),
  cherry: wrap(`<path ${S} fill="none" d="M70 130C80 90 100 60 130 30M140 124c-4-40-6-70-10-94"/><path ${S} fill="#a6c37f" d="M130 30c20-12 44-6 52 6-18 12-38 10-52-6z"/><circle ${S} fill="#ef6a8a" cx="66" cy="146" r="30"/><circle ${S} fill="#ef6a8a" cx="140" cy="142" r="30"/><circle cx="56" cy="136" r="7" fill="#fff" opacity=".8"/><circle cx="130" cy="132" r="7" fill="#fff" opacity=".8"/>`),
  bow: wrap(`<path ${S} fill="#ff5fa2" d="M100 100C70 60 30 50 22 70c-8 22 6 50 26 56 22 6 40-8 52-26zM100 100c30-40 70-50 78-30 8 22-6 50-26 56-22 6-40-8-52-26z"/><path ${S} fill="#ff5fa2" d="M88 110l-22 66 22-8 12 18 4-70M112 110l22 66-22-8-12 18"/><rect ${S} fill="#ffd9e3" x="84" y="84" width="32" height="34" rx="12"/>`),
  sparkle: wrap(`<path ${S} fill="#ffe08a" d="M100 14c8 52 22 68 74 86-52 18-66 34-74 86-8-52-22-68-74-86 52-18 66-34 74-86z"/><path ${S5} fill="#ffd9e3" d="M160 22c3 16 8 21 22 26-14 5-19 10-22 26-3-16-8-21-22-26 14-5 19-10 22-26z"/>`),
  rainbow: wrap(`<path d="M24 150a76 76 0 0 1 152 0" fill="none" stroke="#ff5fa2" stroke-width="20"/><path d="M46 150a54 54 0 0 1 108 0" fill="none" stroke="#ffe08a" stroke-width="20"/><path d="M68 150a32 32 0 0 1 64 0" fill="none" stroke="#a6c37f" stroke-width="20"/><path ${S} fill="#fff" d="M10 160c0-16 12-24 24-22 4-12 22-14 28 0 12 0 18 8 18 22zM120 160c0-16 12-24 24-22 4-12 22-14 28 0 12 0 18 8 18 22z"/>`),
  love: wrap(`<path ${S} fill="#fff" d="M30 46h140c10 0 16 6 16 16v62c0 10-6 16-16 16H96l-34 30 6-30H30c-10 0-16-6-16-16V62c0-10 6-16 16-16z"/><text x="100" y="108" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-weight="700" font-size="42" fill="#7b68ee">love</text>`),
  smile: wrap(`<circle ${S} fill="#ffe08a" cx="100" cy="100" r="78"/><circle cx="72" cy="88" r="9" fill="#141414"/><circle cx="128" cy="88" r="9" fill="#141414"/><ellipse cx="56" cy="116" rx="13" ry="8" fill="#ff5fa2"/><ellipse cx="144" cy="116" rx="13" ry="8" fill="#ff5fa2"/><path d="M76 120q24 24 48 0" fill="none" ${S}/>`),
  strawberry: wrap(`<path ${S} fill="#ef6a8a" d="M100 182C52 160 30 118 38 84c6-24 34-32 62-30 28-2 56 6 62 30 8 34-14 76-62 98z"/><path ${S} fill="#a6c37f" d="M60 62c10-18 24-12 40-28 16 16 30 10 40 28-14 10-26 4-40 14-14-10-26-4-40-14z"/>${[[78, 96], [118, 92], [98, 120], [74, 136], [126, 130], [100, 154]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="6" fill="#ffe08a"/>`).join("")}`),
};

export const stickers = Object.entries(raw).map(([id, svg]) => ({
  id,
  src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
}));
