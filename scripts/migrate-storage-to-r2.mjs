#!/usr/bin/env node
/* Chép toàn bộ file từ Supabase Storage sang Cloudflare R2 (giữ nguyên khoá "<bucket>/<đường dẫn>")
   rồi đổi link ảnh công khai trong database: <SUPABASE_URL>/storage/v1/object/public/<khoá>  →  <NEXT_PUBLIC_R2_PUBLIC_URL>/<khoá>.
   File riêng tư (order-files, design-assets, mockup-shares): database giữ nguyên đường dẫn, không cần đổi.
   KHÔNG xoá gì trong Supabase Storage. Chạy lại được nhiều lần: file đã có trên R2 (cùng dung lượng) và dòng đã đổi link sẽ bỏ qua.
   Cách chạy (xem docs/R2_MIGRATION.md):  node scripts/migrate-storage-to-r2.mjs --dry-run   rồi   node scripts/migrate-storage-to-r2.mjs */
import { readFileSync, appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// ---------- đọc .env.local ----------
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { console.error("Không đọc được file .env.local (đặt ở thư mục gốc dự án)."); process.exit(1); }

const DRY = process.argv.includes("--dry-run");
const SKIP_DB = process.argv.includes("--files-only");
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const R2_PUBLIC_URL = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "").replace(/\/+$/, "");
const need = ["SUPABASE_SERVICE_ROLE_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BUCKET", "R2_PRIVATE_BUCKET"];
const miss = [...need.filter((k) => !process.env[k]), ...(SUPABASE_URL ? [] : ["SUPABASE_URL"]), ...(R2_PUBLIC_URL ? [] : ["NEXT_PUBLIC_R2_PUBLIC_URL"])];
if (miss.length) { console.error("Thiếu biến trong .env.local: " + miss.join(", ")); process.exit(1); }

const LOG = `migrate-r2-${new Date().toISOString().replace(/[:.]/g, "-")}${DRY ? "-dry" : ""}.log`;
const log = (s) => { console.log(s); appendFileSync(LOG, s + "\n"); };

const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const s3 = new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
const PUBLIC = ["scrapbook", "mockups", "public-assets"], PRIVATE = ["order-files", "design-assets", "mockup-shares"];
const CACHE = "public, max-age=31536000, immutable";

async function listAll(bucket, dir = "", depth = 0) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(bucket).list(dir, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`${bucket}/${dir}: ${error.message}`);
    for (const f of data ?? []) {
      const path = dir ? `${dir}/${f.name}` : f.name;
      if (f.id) out.push({ path, size: Number(f.metadata?.size ?? 0), type: f.metadata?.mimetype || "application/octet-stream" });
      else if (depth < 10) out.push(...(await listAll(bucket, path, depth + 1)));
    }
    if ((data ?? []).length < 1000) break;
  }
  return out;
}
async function r2Size(Bucket, Key) {
  try { const h = await s3.send(new HeadObjectCommand({ Bucket, Key })); return h.ContentLength ?? 0; } catch { return -1; }
}

// ---------- 1. chép file ----------
let copied = 0, skipped = 0, failed = 0;
const { data: buckets, error: be } = await sb.storage.listBuckets();
if (be) { console.error(be.message); process.exit(1); }
log(`${DRY ? "[CHẠY THỬ] " : ""}Bắt đầu ${new Date().toISOString()} · log: ${LOG}`);
for (const b of buckets) {
  const pub = PUBLIC.includes(b.id), priv = PRIVATE.includes(b.id);
  if (!pub && !priv) { log(`Bỏ qua bucket "${b.id}" (không dùng)`); continue; }
  const target = pub ? process.env.R2_PUBLIC_BUCKET : process.env.R2_PRIVATE_BUCKET;
  const files = await listAll(b.id);
  log(`Bucket "${b.id}" → R2 "${target}": ${files.length} file`);
  for (const f of files) {
    const key = `${b.id}/${f.path}`;
    const have = await r2Size(target, key);
    if (have >= 0 && (have === f.size || !f.size)) { skipped++; log(`  = đã có   ${key}`); continue; }
    if (DRY) { copied++; log(`  + sẽ chép ${key} (${f.size} byte)`); continue; }
    try {
      const { data, error } = await sb.storage.from(b.id).download(f.path);
      if (error || !data) throw new Error(error?.message ?? "không tải được");
      const body = Buffer.from(await data.arrayBuffer());
      await s3.send(new PutObjectCommand({ Bucket: target, Key: key, Body: body, ContentType: f.type, ContentLength: body.length, ...(pub ? { CacheControl: CACHE } : {}) }));
      copied++; log(`  + đã chép ${key} (${body.length} byte)`);
    } catch (e) { failed++; log(`  ! LỖI     ${key}: ${e.message}`); }
  }
}
log(`File: ${copied} ${DRY ? "sẽ chép" : "đã chép"} · ${skipped} đã có · ${failed} lỗi`);

// ---------- 2. đổi link ảnh công khai trong database ----------
if (!SKIP_DB) {
  const OLD = `${SUPABASE_URL}/storage/v1/object/public/`, NEW = `${R2_PUBLIC_URL}/`;
  const TABLES = {
    site_settings: ["key"], scrapbook_template_settings: ["surface_type", "n", "style"], home_variant_notes: ["variant_id"],
    packages: ["id"], products: ["id"], options: ["id"], option_groups: ["id"], addons: ["id"], showcase_items: ["id"], reviews: ["id"],
    guide_sections: ["id"], design_templates: ["id"], photostrip_frames: ["id"], canva_templates: ["id"], mockup_frames: ["id"], mockup_backgrounds: ["id"],
    scrapbook_assets: ["id"], scrapbook_templates: ["id"], frames: ["id"], frame_sets: ["id"], cutout_fonts: ["id"], cutout_glyphs: ["id"],
    wish_topics: ["id"], wishes: ["id"], designs: ["id"], mockup_shares: ["id"], order_items: ["id"], cart_items: ["id"],
  };
  const swap = (v) => {
    if (typeof v === "string") return v.includes(OLD) ? v.split(OLD).join(NEW) : v;
    if (Array.isArray(v)) return v.map(swap);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)]));
    return v;
  };
  let rows = 0;
  for (const [t, pk] of Object.entries(TABLES)) {
    for (let from = 0; ; from += 500) {
      const { data, error } = await sb.from(t).select("*").range(from, from + 499);
      if (error) { log(`Bỏ qua bảng ${t}: ${error.message}`); break; }
      for (const r of data ?? []) {
        if (!JSON.stringify(r).includes(OLD)) continue;
        const patch = {};
        for (const [c, v] of Object.entries(r)) { const n = swap(v); if (JSON.stringify(n) !== JSON.stringify(v)) patch[c] = n; }
        const where = Object.fromEntries(pk.map((k) => [k, r[k]]));
        if (DRY) { rows++; log(`  ~ sẽ đổi ${t} ${JSON.stringify(where)}: ${Object.keys(patch).join(", ")}`); continue; }
        const { error: ue } = await sb.from(t).update(patch).match(where);
        if (ue) log(`  ! LỖI đổi ${t} ${JSON.stringify(where)}: ${ue.message}`);
        else { rows++; log(`  ~ đã đổi ${t} ${JSON.stringify(where)}: ${Object.keys(patch).join(", ")}`); }
      }
      if ((data ?? []).length < 500) break;
    }
  }
  log(`Database: ${rows} dòng ${DRY ? "sẽ đổi" : "đã đổi"} link ảnh`);
}
log(`Xong ${new Date().toISOString()}${failed ? ` — còn ${failed} file lỗi, chạy lại lệnh để thử lại` : ""}`);
