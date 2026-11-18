"use client";

/* Kéo giãn 1 ảnh vào tứ giác theo phối cảnh. WebGL: lấy mẫu song tuyến, khử răng cưa mép (fwidth).
   Không có WebGL thì dùng canvas 2D chia lưới tam giác. */
import { apply, invert, squareToQuad } from "./homography";

let gl: WebGL2RenderingContext | null | undefined;
let glCanvas: HTMLCanvasElement | null = null;
let prog: WebGLProgram | null = null;

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D tex; uniform mat3 inv; uniform vec2 size;
out vec4 o;
void main(){
  vec2 px = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
  vec3 q = inv * vec3(px, 1.0);
  vec2 uv = q.xy / q.z;
  // khoảng cách tới mép (đơn vị uv) → độ phủ mềm 1px
  vec2 d = min(uv, 1.0 - uv);
  vec2 fw = max(fwidth(uv), vec2(1e-6));
  float a = clamp(min(d.x / fw.x, d.y / fw.y) + 0.5, 0.0, 1.0);
  if (a <= 0.0) discard;
  vec4 c = texture(tex, clamp(uv, 0.0, 1.0));
  o = c * a;
}`;

function initGL(): WebGL2RenderingContext | null {
  if (gl !== undefined) return gl;
  try {
    glCanvas = document.createElement("canvas");
    gl = glCanvas.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false }) as WebGL2RenderingContext | null;
    if (!gl) return (gl = null);
    const sh = (t: number, src: string) => { const s = gl!.createShader(t)!; gl!.shaderSource(s, src); gl!.compileShader(s); if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(s) ?? ""); return s; };
    prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  } catch { gl = null; }
  return gl;
}

// Thu nhỏ nguồn quá lớn cho vừa texture
function fitSource(src: CanvasImageSource & { width: number; height: number }, max = 4096) {
  const w = src.width, h = src.height;
  if (w <= max && h <= max) return src;
  const k = max / Math.max(w, h);
  const c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const x = c.getContext("2d")!; x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Vẽ src vào tứ giác quad (toạ độ px trên canvas W×H). Trả về canvas W×H trong suốt. */
export function warpToQuad(srcIn: CanvasImageSource & { width: number; height: number }, quad: [number, number][], W: number, H: number): HTMLCanvasElement {
  const src = fitSource(srcIn);
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  const H3 = squareToQuad(quad);
  const g = initGL();
  if (g && prog && glCanvas) {
    glCanvas.width = W; glCanvas.height = H;
    g.viewport(0, 0, W, H);
    g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
    g.useProgram(prog);
    const tex = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, tex);
    g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src as TexImageSource);
    g.generateMipmap(g.TEXTURE_2D);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    const inv = invert(H3);
    // mat3 của GLSL theo cột
    g.uniformMatrix3fv(g.getUniformLocation(prog, "inv"), false, [inv[0], inv[3], inv[6], inv[1], inv[4], inv[7], inv[2], inv[5], inv[8]]);
    g.uniform2f(g.getUniformLocation(prog, "size"), W, H);
    g.uniform1i(g.getUniformLocation(prog, "tex"), 0);
    g.drawArrays(g.TRIANGLES, 0, 6);
    g.deleteTexture(tex);
    out.getContext("2d")!.drawImage(glCanvas, 0, 0);
    return out;
  }
  // Canvas 2D: lưới tam giác 24 × 24, mỗi tam giác là 1 phép affine
  const ctx = out.getContext("2d")!;
  const N = 24, sw = src.width, sh = src.height;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const u0 = i / N, u1 = (i + 1) / N, v0 = j / N, v1 = (j + 1) / N;
    const P = (u: number, v: number) => apply(H3, u, v);
    tri(ctx, src, [u0 * sw, v0 * sh], [u1 * sw, v0 * sh], [u1 * sw, v1 * sh], P(u0, v0), P(u1, v0), P(u1, v1));
    tri(ctx, src, [u0 * sw, v0 * sh], [u1 * sw, v1 * sh], [u0 * sw, v1 * sh], P(u0, v0), P(u1, v1), P(u0, v1));
  }
  return out;
}

function tri(ctx: CanvasRenderingContext2D, img: CanvasImageSource, s0: number[], s1: number[], s2: number[], d0: number[], d1: number[], d2: number[]) {
  // nới tam giác 0.5px để không hở đường nối
  const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
  const grow = (p: number[]) => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + (dx / l) * 0.6, p[1] + (dy / l) * 0.6]; };
  const [a, b, c] = [grow(d0), grow(d1), grow(d2)];
  ctx.save();
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath(); ctx.clip();
  const den = s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]);
  if (Math.abs(den) < 1e-9) { ctx.restore(); return; }
  const m11 = (d0[0] * (s1[1] - s2[1]) + d1[0] * (s2[1] - s0[1]) + d2[0] * (s0[1] - s1[1])) / den;
  const m12 = (d0[1] * (s1[1] - s2[1]) + d1[1] * (s2[1] - s0[1]) + d2[1] * (s0[1] - s1[1])) / den;
  const m21 = (d0[0] * (s2[0] - s1[0]) + d1[0] * (s0[0] - s2[0]) + d2[0] * (s1[0] - s0[0])) / den;
  const m22 = (d0[1] * (s2[0] - s1[0]) + d1[1] * (s0[0] - s2[0]) + d2[1] * (s1[0] - s0[0])) / den;
  const dx = (d0[0] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[0] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[0] * (s0[0] * s1[1] - s1[0] * s0[1])) / den;
  const dy = (d0[1] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[1] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[1] * (s0[0] * s1[1] - s1[0] * s0[1])) / den;
  ctx.setTransform(m11, m12, m21, m22, dx, dy);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
