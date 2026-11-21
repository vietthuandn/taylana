/* Danh sách font Google cho mọi trình chỉnh (CD Template, Booklet Template, Booklet Lyrics, trình sửa mẫu admin).
   CHỈ gồm font có subset "vietnamese" thật sự — đã kiểm theo metadata.json của gói @fontsource tương ứng (đồng bộ Google Fonts).
   Đã bỏ vì không có tiếng Việt: Caveat, Kalam, Courier Prime, Lilita One, Darumadrop One.
   weights: các độ đậm có sẵn · italic: có kiểu nghiêng. Admin bật / tắt / sắp xếp ở Quản lý chất liệu → Font chữ (site_settings.google_fonts). */
export type FontGroup = "sans" | "serif" | "hand" | "display" | "mono";
export type GFont = { family: string; group: FontGroup; weights: number[]; italic: boolean };
export const FONT_GROUPS: [FontGroup, string][] = [["sans", "Không chân"], ["serif", "Có chân"], ["hand", "Viết tay"], ["display", "Tiêu đề"], ["mono", "Đơn cách"]];
export const WEIGHT_NAMES: [number, string][] = [[300, "Mảnh"], [400, "Thường"], [500, "Vừa"], [700, "Đậm"], [800, "Rất đậm"]];

export const FONT_CATALOG: GFont[] = [
  { family: "Be Vietnam Pro", group: "sans", weights: [100,  200,  300,  400,  500,  600,  700,  800,  900], italic: true },
  { family: "Inter", group: "sans", weights: [100,  200,  300,  400,  500,  600,  700,  800,  900], italic: true },
  { family: "Roboto", group: "sans", weights: [100,  200,  300,  400,  500,  600,  700,  800,  900], italic: true },
  { family: "Montserrat", group: "sans", weights: [100,  200,  300,  400,  500,  600,  700,  800,  900], italic: true },
  { family: "Nunito", group: "sans", weights: [200,  300,  400,  500,  600,  700,  800,  900], italic: true },
  { family: "Quicksand", group: "sans", weights: [300,  400,  500,  600,  700], italic: false },
  { family: "Lexend", group: "sans", weights: [100,  200,  300,  400,  500,  600,  700,  800,  900], italic: false },
  { family: "Plus Jakarta Sans", group: "sans", weights: [200,  300,  400,  500,  600,  700,  800], italic: true },
  { family: "Josefin Sans", group: "sans", weights: [100,  200,  300,  400,  500,  600,  700], italic: true },
  { family: "Comfortaa", group: "sans", weights: [300,  400,  500,  600,  700], italic: false },
  { family: "Asap", group: "sans", weights: [100,  200,  300,  400,  500,  600,  700,  800,  900], italic: true },
  { family: "Signika", group: "sans", weights: [300,  400,  500,  600,  700], italic: false },
  { family: "Saira", group: "sans", weights: [100,  200,  300,  400,  500,  600,  700,  800,  900], italic: true },
  { family: "Chakra Petch", group: "sans", weights: [300,  400,  500,  600,  700], italic: true },
  { family: "Baloo 2", group: "sans", weights: [400,  500,  600,  700,  800], italic: false },
  { family: "Open Sans", group: "sans", weights: [300,  400,  500,  600,  700,  800], italic: true },
  { family: "Mulish", group: "sans", weights: [200,  300,  400,  500,  600,  700,  800,  900], italic: true },
  { family: "Lora", group: "serif", weights: [400,  500,  600,  700], italic: true },
  { family: "Playfair Display", group: "serif", weights: [400,  500,  600,  700,  800,  900], italic: true },
  { family: "Merriweather", group: "serif", weights: [300,  400,  500,  600,  700,  800,  900], italic: true },
  { family: "Noto Serif", group: "serif", weights: [100,  200,  300,  400,  500,  600,  700,  800,  900], italic: true },
  { family: "EB Garamond", group: "serif", weights: [400,  500,  600,  700,  800], italic: true },
  { family: "Cormorant Garamond", group: "serif", weights: [300,  400,  500,  600,  700], italic: true },
  { family: "Roboto Slab", group: "serif", weights: [100,  200,  300,  400,  500,  600,  700,  800,  900], italic: false },
  { family: "Literata", group: "serif", weights: [200,  300,  400,  500,  600,  700,  800,  900], italic: true },
  { family: "Alegreya", group: "serif", weights: [400,  500,  600,  700,  800,  900], italic: true },
  { family: "Crimson Pro", group: "serif", weights: [200,  300,  400,  500,  600,  700,  800,  900], italic: true },
  { family: "Dancing Script", group: "hand", weights: [400,  500,  600,  700], italic: false },
  { family: "Charm", group: "hand", weights: [400,  700], italic: false },
  { family: "Pacifico", group: "hand", weights: [400], italic: false },
  { family: "Lobster", group: "hand", weights: [400], italic: false },
  { family: "Great Vibes", group: "hand", weights: [400], italic: false },
  { family: "Sriracha", group: "hand", weights: [400], italic: false },
  { family: "Mali", group: "hand", weights: [200,  300,  400,  500,  600,  700], italic: true },
  { family: "Itim", group: "hand", weights: [400], italic: false },
  { family: "Pangolin", group: "hand", weights: [400], italic: false },
  { family: "Patrick Hand", group: "hand", weights: [400], italic: false },
  { family: "Grandstander", group: "hand", weights: [100,  200,  300,  400,  500,  600,  700,  800,  900], italic: true },
  { family: "Fuzzy Bubbles", group: "hand", weights: [400,  700], italic: false },
  { family: "Playpen Sans", group: "hand", weights: [100,  200,  300,  400,  500,  600,  700,  800], italic: false },
  { family: "Oswald", group: "display", weights: [200,  300,  400,  500,  600,  700], italic: false },
  { family: "Anton", group: "display", weights: [400], italic: false },
  { family: "Bungee", group: "display", weights: [400], italic: false },
  { family: "Paytone One", group: "display", weights: [400], italic: false },
  { family: "Coiny", group: "display", weights: [400], italic: false },
  { family: "Bangers", group: "display", weights: [400], italic: false },
  { family: "Phudu", group: "display", weights: [300,  400,  500,  600,  700,  800,  900], italic: false },
  { family: "Cherry Bomb One", group: "display", weights: [400], italic: false },
  { family: "Yeseva One", group: "display", weights: [400], italic: false },
  { family: "Roboto Mono", group: "mono", weights: [100,  200,  300,  400,  500,  600,  700], italic: true },
  { family: "Space Mono", group: "mono", weights: [400,  700], italic: true },
  { family: "JetBrains Mono", group: "mono", weights: [100,  200,  300,  400,  500,  600,  700,  800], italic: true },
  { family: "IBM Plex Mono", group: "mono", weights: [100,  200,  300,  400,  500,  600,  700], italic: true },
];
export const fontInfo = (family: string | undefined | null, list: GFont[] = FONT_CATALOG) => (family ? list.find((f) => f.family === family) : undefined);
/** độ đậm gần nhất font có */
export const nearestWeight = (f: GFont | undefined, w: number) => (!f || !f.weights.length ? w : f.weights.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a)));
