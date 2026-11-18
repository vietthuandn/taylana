/* Kiểu trình bày lời (chỉ đổi cách HIỂN THỊ khi dàn trang — không sửa lời gốc khách đã nhập):
   - collapseRepeats: câu lặp liền nhau → "câu (x2)"; đoạn lặp (giống hệt sau khi chuẩn hoá: không phân biệt hoa thường,
     bỏ dấu câu và khoảng trắng thừa) → lần đầu giữ lời + nhãn "[Chorus]", các lần sau thành 1 dòng "(Chorus)".
     Đoạn chỉ khác vài từ KHÔNG gộp (chỉ gộp đoạn giống hệt).
   - toInline: kiểu booklet album pop — dòng trong đoạn nối bằng " / ", đoạn nối bằng " // " (hoặc xuống dòng). */

export type LabelLang = "en" | "vi";
export type CollapseOpts = { lang?: LabelLang; labels?: Record<string, string>; noMerge?: string[] };
export type FBlock = { kind: "para"; key: string; label?: string; lines: string[] } | { kind: "ref"; key: string; label: string };
export type RepeatGroup = { key: string; name: string; count: number; preview: string };

const NAMES: Record<LabelLang, string[]> = { en: ["Chorus", "Pre-Chorus", "Bridge"], vi: ["Điệp khúc", "Phiên khúc", "Bridge"] };
export const normKey = (s: string) => s.toLowerCase().replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/g, " ").trim();
const paras = (lyrics: string) => lyrics.replace(/\r/g, "").split(/\n\s*\n/).map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean)).filter((p) => p.length);
// khoá ngắn của 1 đoạn (để lưu tên nhãn / "không gộp" theo đoạn)
const keyOf = (lines: string[]) => { let h = 5381; for (const c of lines.map(normKey).join("|")) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(36); };
// câu lặp liền nhau → "câu (x2)"
function collapseLines(lines: string[]) {
  const out: string[] = [];
  for (let i = 0; i < lines.length; ) {
    let j = i + 1;
    while (j < lines.length && normKey(lines[j]) === normKey(lines[i])) j++;
    out.push(j - i > 1 ? `${lines[i]} (x${j - i})` : lines[i]);
    i = j;
  }
  return out;
}

/** Các đoạn lặp phát hiện được (để khách đổi tên nhãn / bỏ gộp trong modal lyrics) */
export function repeatGroups(lyrics: string, o: CollapseOpts = {}): RepeatGroup[] {
  const P = paras(lyrics), count = new Map<string, number>(), first = new Map<string, string[]>();
  for (const p of P) { const k = keyOf(p); count.set(k, (count.get(k) ?? 0) + 1); if (!first.has(k)) first.set(k, p); }
  const names = NAMES[o.lang ?? "en"], base = names[0];
  let n = 0;
  const out: RepeatGroup[] = [];
  for (const p of P) {
    const k = keyOf(p);
    if ((count.get(k) ?? 0) < 2 || out.some((g) => g.key === k)) continue;
    const auto = n < names.length ? names[n] : `${base} ${n - names.length + 2}`;
    n++;
    out.push({ key: k, name: o.labels?.[k]?.trim() || auto, count: count.get(k)!, preview: first.get(k)!.slice(0, 2).join(" / ") });
  }
  return out;
}

export function collapseRepeats(lyrics: string, o: CollapseOpts = {}): FBlock[] {
  const groups = repeatGroups(lyrics, o).filter((g) => !o.noMerge?.includes(g.key));
  const seen = new Set<string>();
  return paras(lyrics).map((p) => {
    const k = keyOf(p), g = groups.find((x) => x.key === k);
    if (!g) return { kind: "para", key: k, lines: collapseLines(p) };
    if (seen.has(k)) return { kind: "ref", key: k, label: g.name };
    seen.add(k);
    return { kind: "para", key: k, label: g.name, lines: collapseLines(p) };
  });
}

export type InlineOpts = CollapseOpts & { paraBreak?: "slashes" | "newline" };
/** Liền dòng: trả về các đoạn văn (1 đoạn nếu nối bằng " // ", nhiều đoạn nếu xuống dòng giữa các đoạn) */
export function toInline(lyrics: string, o: InlineOpts = {}): string[] {
  const parts = collapseRepeats(lyrics, o).map((b) => (b.kind === "ref" ? `(${b.label})` : b.lines.join(" / ")));
  return o.paraBreak === "newline" ? parts : parts.length ? [parts.join(" // ")] : [];
}
