"use client";

/* Thẻ "3D" ở trang Xem Mockup: hộp CD jewel case kiểu ảnh chụp sản phẩm (three + @react-three/fiber + drei + postprocessing).
   Chỉ tải khi khách chọn thẻ 3D (next/dynamic, ssr: false). Đơn vị trong cảnh: 1 = 10 mm (U(mm)).
   Trục: X = chiều rộng (bản lề bên trái, x âm) · Y = chiều dày (hướng lên) · Z = chiều cao bìa (mép trên ở z âm).
   Có mô hình .glb do admin tải lên (lib/mockup3d/glb.ts) → dùng model đó thay cho hộp tự dựng. */
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, PerformanceMonitor, RoundedBox, useGLTF } from "@react-three/drei";
import { EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode, type EffectComposer as ComposerImpl } from "postprocessing";
import type { OrbitControls as OrbitImpl } from "three-stdlib";
import { BookOpen, RotateCcw } from "lucide-react";
import {
  CASE_H_MM, CASE_T_MM, CASE_W_MM, COVER3D_MM, DISC3D_D_MM, DISC3D_HOLE_MM, DISC3D_T_MM,
  TRAY_FLOOR_MM, TRAY_H_MM, TRAY_SPINE_MM, TRAY_W_MM,
} from "@/lib/cdSpecs";
import { coverCrop } from "@/lib/mockup/coverCrop";
import type { TrayStyle } from "@/lib/mockup/types";
import { discRings, paperNormal, scratchMap } from "@/lib/mockup3d/textures";
import { GLB_HINGE } from "@/lib/mockup3d/glb";

const U = (mm: number) => mm / 10;
const CW = U(CASE_W_MM), CH = U(CASE_H_MM), CT = U(CASE_T_MM);
const COVER = U(COVER3D_MM), TW = U(TRAY_FLOOR_MM), TH = U(TRAY_H_MM), SP = U(TRAY_SPINE_MM);
const DR = U(DISC3D_D_MM) / 2, DT = U(DISC3D_T_MM), DH = U(DISC3D_HOLE_MM) / 2;
const R = U(0.8); // bo cạnh 0.8 mm
const BASE_T = U(1.2); // đáy đế
const LID_T = U(1); // mặt nắp (mỏng hơn viền)
const RIM_T = U(1.5); // viền nắp dày 1.5 mm
const OPEN_ANGLE = (110 * Math.PI) / 180;
const HDRI = "/hdri/studio_1k.hdr";

// Góc máy kiểu chụp sản phẩm: FOV 28°, nghiêng 3/4, nhìn từ trên xuống ~20°
const FOV = 28;
const TARGET0 = new THREE.Vector3(0, CT / 2, 0);
const VIEW = { closed: { r: 46, elev: 20 }, open: { r: 54, elev: 34 }, az: 36 };
const camAt = (r: number, elevDeg: number, azDeg: number) => {
  const e = THREE.MathUtils.degToRad(elevDeg), a = THREE.MathUtils.degToRad(azDeg);
  return new THREE.Vector3(Math.sin(a) * Math.cos(e) * r, Math.sin(e) * r, Math.cos(a) * Math.cos(e) * r).add(TARGET0);
};

type Src = HTMLImageElement | null | undefined;
/** Ảnh của gói: undefined = không có giấy này · null = có giấy nhưng chưa có ảnh (giấy trắng) */
export type Cd3DImages = { frontOut?: Src; frontIn?: Src; backOut?: Src; backIn?: Src; disc?: Src };
export type Cd3DHandle = { capture: (longSide: number) => HTMLCanvasElement | null };
export type CoverFinish = "matte" | "gloss";

// ---------- texture ảnh khách ----------
function tex(c: HTMLCanvasElement, flipY = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.flipY = flipY;
  t.needsUpdate = true;
  return t;
}
const crop = (c: HTMLCanvasElement, x0: number, x1: number) => {
  const o = document.createElement("canvas");
  o.width = Math.max(1, Math.round((x1 - x0) * c.width)); o.height = c.height;
  o.getContext("2d")!.drawImage(c, x0 * c.width, 0, o.width, c.height, 0, 0, o.width, o.height);
  return o;
};
// xoay dải gáy (đứng) thành nằm ngang: cw = mép trên ảnh → bên phải
const turn = (c: HTMLCanvasElement, cw: boolean) => {
  const o = document.createElement("canvas");
  o.width = c.height; o.height = c.width;
  const x = o.getContext("2d")!;
  if (cw) { x.translate(o.width, 0); x.rotate(Math.PI / 2); } else { x.translate(0, o.height); x.rotate(-Math.PI / 2); }
  x.drawImage(c, 0, 0);
  return o;
};
// Bìa sau: cắt phủ kín 150 × 117 → [gáy trái | đáy 138 | gáy phải]
function splitTray(img: HTMLImageElement) {
  const c = coverCrop(img, TRAY_W_MM / TRAY_H_MM, 2048);
  const s = TRAY_SPINE_MM / TRAY_W_MM;
  return { left: crop(c, 0, s), floor: crop(c, s, 1 - s), right: crop(c, 1 - s, 1) };
}

// ---------- chất liệu ----------
function plasticMaterial(side: THREE.Side = THREE.FrontSide) {
  const m = new THREE.MeshPhysicalMaterial({
    color: "#ffffff", transmission: 1, thickness: U(1.5), roughness: 1, roughnessMap: scratchMap(), ior: 1.49,
    clearcoat: 1, clearcoatRoughness: 0.03, attenuationColor: new THREE.Color("#f4fbff"), attenuationDistance: 80,
    metalness: 0, specularIntensity: 1, envMapIntensity: 1.1, side,
  });
  return m; // roughnessMap: nền ≈ 0.04, vết xước nhám hơn
}
function Plastic({ double = false }: { double?: boolean }) {
  const m = useMemo(() => plasticMaterial(double ? THREE.DoubleSide : THREE.FrontSide), [double]);
  return <primitive object={m} attach="material" />;
}
function Paper({ map, finish = "matte" }: { map: THREE.Texture | null; finish?: CoverFinish }) {
  const gloss = finish === "gloss";
  return (
    <meshPhysicalMaterial key={(map ? map.uuid : "white") + finish} map={map} color="#ffffff"
      roughness={gloss ? 0.25 : 0.65} clearcoat={gloss ? 0.5 : 0} clearcoatRoughness={0.2} metalness={0}
      normalMap={paperNormal()} normalScale={new THREE.Vector2(0.12, 0.12)} sheen={0.25} sheenRoughness={0.8} sheenColor="#ffffff" />
  );
}
function Black() { return <meshStandardMaterial color="#141416" roughness={0.42} metalness={0} />; }

// 1 mặt giấy (plane 1 mặt). face: "up" (nhìn từ trên, mép trên ảnh ở z âm) · "down" (nhìn từ dưới) · "+x" / "-x" (đứng ở cạnh bên)
function Sheet({ w, h, map, face, position, finish }: { w: number; h: number; map: THREE.Texture | null; face: "up" | "down" | "+x" | "-x"; position: [number, number, number]; finish?: CoverFinish }) {
  const rot: [number, number, number] = face === "up" ? [-Math.PI / 2, 0, 0] : face === "down" ? [Math.PI / 2, 0, 0] : [0, face === "+x" ? Math.PI / 2 : -Math.PI / 2, 0];
  return (
    <group position={position} rotation={face === "down" ? [0, Math.PI, 0] : [0, 0, 0]}>
      <mesh rotation={rot} castShadow receiveShadow>
        <planeGeometry args={[w, h]} />
        <Paper map={map} finish={finish} />
      </mesh>
    </group>
  );
}

// ---------- đĩa CD ----------
// Thân đĩa (tiện tròn): mép ngoài vát nhẹ, mép lỗ bo tròn
function discProfile() {
  const p: THREE.Vector2[] = [];
  const h = DT / 2, b = U(0.3), arc = 8;
  // mép lỗ bo tròn (nửa vòng)
  for (let i = 0; i <= arc; i++) { const a = -Math.PI / 2 + (i / arc) * Math.PI; p.push(new THREE.Vector2(DH + h - Math.cos(a) * h, Math.sin(a) * h)); }
  p.push(new THREE.Vector2(DR - b, h), new THREE.Vector2(DR, h - b * 0.6), new THREE.Vector2(DR, -h + b * 0.6), new THREE.Vector2(DR - b, -h));
  p.push(new THREE.Vector2(DH + h, -h));
  return p;
}
function Disc({ img }: { img: Src }) {
  const map = useMemo(() => (img ? tex(coverCrop(img, 1, 1600)) : null), [img]);
  const profile = useMemo(discProfile, []);
  const rings = useMemo(() => discRings(), []);
  const clearIn = DH + U(7); // vùng trong suốt quanh lỗ rộng ~7 mm
  const printOut = DR - U(1);
  return (
    <group>
      <mesh castShadow receiveShadow><latheGeometry args={[profile, 160]} /><Plastic double /></mesh>
      {/* mặt in */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, DT / 2 + 0.002, 0]} receiveShadow>
        <ringGeometry args={[clearIn, printOut, 160, 1]} />
        <meshPhysicalMaterial key={map ? map.uuid : "w"} map={map} color="#ffffff" roughness={0.45} metalness={0} clearcoat={0.2} />
      </mesh>
      {/* vòng nổi (stacking ring) mảnh, trên + dưới */}
      {[1, -1].map((k) => (
        <mesh key={k} rotation={[Math.PI / 2, 0, 0]} position={[0, k * (DT / 2 + 0.004), 0]}>
          <torusGeometry args={[DH + U(4.5), U(0.25), 8, 96]} />
          <Plastic />
        </mesh>
      ))}
      {/* mặt dưới: bạc kim loại + vệt cầu vồng chạy theo vòng tròn đồng tâm */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -DT / 2 - 0.002, 0]}>
        <ringGeometry args={[clearIn, printOut, 160, 1]} />
        <meshPhysicalMaterial color="#ffffff" map={rings} metalness={1} roughness={0.15} iridescence={1} iridescenceIOR={1.8}
          iridescenceThicknessRange={[200, 800]} iridescenceThicknessMap={rings} />
      </mesh>
    </group>
  );
}

// ---------- hộp tự dựng ----------
function BuiltCase({ images, tray, finish, open, lifted, onToggleOpen, onToggleLift }: {
  images: Cd3DImages; tray: TrayStyle; finish: CoverFinish; open: boolean; lifted: boolean; onToggleOpen: () => void; onToggleLift: () => void;
}) {
  const lid = useRef<THREE.Group>(null);
  const disc = useRef<THREE.Group>(null);
  const anim = useRef({ lid: 0, lift: 0 });
  const DISC_Y = BASE_T + U(3.2) + DT / 2; // đĩa nằm trên ngàm giữ

  // texture giấy (cập nhật ngay khi đổi ảnh — không dựng lại cảnh)
  const fOut = useMemo(() => (images.frontOut ? tex(coverCrop(images.frontOut, 1, 2048)) : null), [images.frontOut]);
  const fIn = useMemo(() => (images.frontIn ? tex(coverCrop(images.frontIn, 1, 2048)) : null), [images.frontIn]);
  const bOutT = useMemo(() => { if (!images.backOut) return null; const s = splitTray(images.backOut); return { floor: tex(s.floor), l: tex(turn(s.left, true)), r: tex(turn(s.right, false)) }; }, [images.backOut]);
  const bInT = useMemo(() => { if (!images.backIn) return null; const s = splitTray(images.backIn); return { floor: tex(s.floor), l: tex(turn(s.left, true)), r: tex(turn(s.right, false)) }; }, [images.backIn]);
  const hasFront = images.frontOut !== undefined || images.frontIn !== undefined;
  const hasBack = images.backOut !== undefined || images.backIn !== undefined;

  // nắp: mở/đóng 110° trong 0.8 s (easing mượt) · đĩa: nhấc 15 mm + xoay chậm
  useFrame((_, dt) => {
    const a = anim.current;
    a.lid = THREE.MathUtils.clamp(a.lid + (open ? 1 : -1) * (dt / 0.8), 0, 1);
    a.lift = THREE.MathUtils.clamp(a.lift + (lifted ? 1 : -1) * (dt / 0.6), 0, 1);
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    if (lid.current) lid.current.rotation.z = ease(a.lid) * OPEN_ANGLE;
    if (disc.current) {
      disc.current.position.y = DISC_Y + ease(a.lift) * U(15);
      if (a.lift > 0) disc.current.rotation.y += dt * 0.5 * ease(a.lift);
    }
  });
  const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = "pointer"; };
  const out = () => { document.body.style.cursor = ""; };
  useEffect(() => () => { document.body.style.cursor = ""; }, []);

  const spineW = U(2.6), wallH = CT - BASE_T - U(3.2); // gáy đế cao tới sát viền nắp (viền nắp sâu 3 mm)
  const trayMat = tray === "black" ? <Black /> : <Plastic />;
  const trayTop = BASE_T + U(1.6);
  return (
    <group>
      {/* ---------- ĐẾ ---------- */}
      <group onClick={(e) => { e.stopPropagation(); onToggleOpen(); }} onPointerOver={over} onPointerOut={out}>
        <RoundedBox args={[CW, BASE_T, CH]} radius={R * 0.7} smoothness={3} position={[0, BASE_T / 2, 0]} castShadow receiveShadow><Plastic /></RoundedBox>
        {/* 2 thanh gáy bên + rãnh gân mảnh chạy dọc */}
        {[-1, 1].map((k) => (
          <group key={`sp${k}`} position={[k * (CW / 2 - spineW / 2), BASE_T + wallH / 2, 0]}>
            <RoundedBox args={[spineW, wallH, CH]} radius={R} smoothness={3} castShadow receiveShadow><Plastic /></RoundedBox>
            {Array.from({ length: 5 }, (_, i) => (
              <mesh key={i} position={[k * (spineW / 2 + 0.002), -wallH / 2 + ((i + 1) / 6) * wallH, 0]}>
                <boxGeometry args={[U(0.15), U(0.18), CH - U(6)]} /><Plastic />
              </mesh>
            ))}
          </group>
        ))}
        {/* 2 thành trước / sau thấp */}
        {[-1, 1].map((k) => (
          <RoundedBox key={`w${k}`} args={[CW - spineW * 2, U(4), U(1.2)]} radius={R * 0.6} smoothness={2} position={[0, BASE_T + U(2), k * (CH / 2 - U(0.6))]} castShadow><Plastic /></RoundedBox>
        ))}
        {/* bìa sau: đáy 138 + 2 gáy 6 mm gập lên đúng vị trí gáy, chừa khe nhỏ với nhựa */}
        {hasBack && (
          <group>
            <Sheet w={TW} h={TH} map={bOutT?.floor ?? null} face="down" position={[0, BASE_T + 0.004, 0]} finish={finish} />
            <Sheet w={TW} h={TH} map={bInT?.floor ?? null} face="up" position={[0, BASE_T + 0.008, 0]} />
            <Sheet w={TH} h={SP} map={bOutT?.l ?? null} face="+x" position={[TW / 2 + 0.003, BASE_T + SP / 2, 0]} finish={finish} />
            <Sheet w={TH} h={SP} map={bOutT?.r ?? null} face="-x" position={[-TW / 2 - 0.003, BASE_T + SP / 2, 0]} finish={finish} />
            <Sheet w={TH} h={SP} map={bInT?.l ?? null} face="+x" position={[-TW / 2 + 0.003, BASE_T + SP / 2, 0]} />
            <Sheet w={TH} h={SP} map={bInT?.r ?? null} face="-x" position={[TW / 2 - 0.003, BASE_T + SP / 2, 0]} />
          </group>
        )}
        {/* khay đĩa: tấm khay + vòng gờ tròn + 4 lỗ góc + cụm ngàm (rosette) 12 cánh */}
        <RoundedBox args={[TW - U(3), U(0.8), TH - U(3)]} radius={U(0.35)} smoothness={2} position={[0, trayTop - U(0.4), 0]} castShadow receiveShadow>{trayMat}</RoundedBox>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, trayTop + U(0.3), 0]} castShadow>
          <torusGeometry args={[DR + U(1.5), U(0.2), 8, 128]} />{trayMat}
        </mesh>
        {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => (
          <mesh key={`h${sx}${sz}`} rotation={[Math.PI / 2, 0, 0]} position={[sx * (TW / 2 - U(6)), trayTop + 0.002, sz * (TH / 2 - U(6))]}>
            <torusGeometry args={[U(1.6), U(0.25), 8, 32]} /><meshStandardMaterial color={tray === "black" ? "#050506" : "#cdd6dc"} roughness={0.35} />
          </mesh>
        ))}
        <mesh position={[0, trayTop + U(0.8), 0]} castShadow><cylinderGeometry args={[DH + U(2.4), DH + U(3), U(1.6), 48]} />{trayMat}</mesh>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <RoundedBox key={`p${i}`} args={[U(3.2), U(1.2), U(1.6)]} radius={U(0.4)} smoothness={2}
              position={[Math.cos(a) * (DH + U(0.6)), trayTop + U(2.2), Math.sin(a) * (DH + U(0.6))]} rotation={[0, -a, 0.18]} castShadow>{trayMat}</RoundedBox>
          );
        })}
      </group>

      {/* ---------- ĐĨA ---------- */}
      <group ref={disc} position={[0, DISC_Y, 0]}
        onClick={(e) => { e.stopPropagation(); if (open) onToggleLift(); else onToggleOpen(); }} onPointerOver={over} onPointerOut={out}>
        <Disc img={images.disc ?? null} />
      </group>

      {/* ---------- NẮP (bản lề cạnh trái: 2 khớp tròn trên + dưới) ---------- */}
      <group ref={lid} position={[-CW / 2, CT, 0]} onClick={(e) => { e.stopPropagation(); onToggleOpen(); }} onPointerOver={over} onPointerOut={out}>
        {/* mặt nắp mỏng */}
        <RoundedBox args={[CW - U(1), LID_T, CH]} radius={R * 0.6} smoothness={3} position={[CW / 2 + U(0.5), -LID_T / 2, 0]} castShadow receiveShadow><Plastic /></RoundedBox>
        {/* viền nắp dày 1.5 mm: trên / dưới / cạnh mở */}
        {[-1, 1].map((k) => (
          <RoundedBox key={`r${k}`} args={[CW - U(4), U(3), RIM_T]} radius={R * 0.6} smoothness={2} position={[CW / 2 + U(1.5), -U(1.5), k * (CH / 2 - RIM_T / 2)]} castShadow><Plastic /></RoundedBox>
        ))}
        <RoundedBox args={[RIM_T, U(3), CH]} radius={R * 0.6} smoothness={2} position={[CW - RIM_T / 2, -U(1.5), 0]} castShadow><Plastic /></RoundedBox>
        {/* gờ cầm ở cạnh mở */}
        <RoundedBox args={[U(1.2), U(2), U(28)]} radius={U(0.5)} smoothness={3} position={[CW + U(0.3), -U(1.5), 0]} castShadow><Plastic /></RoundedBox>
        {/* 2 khớp bản lề tròn */}
        {[-1, 1].map((k) => (
          <mesh key={`k${k}`} rotation={[Math.PI / 2, 0, 0]} position={[U(1), -U(1.6), k * (CH / 2 - U(8))]} castShadow>
            <cylinderGeometry args={[U(1.6), U(1.6), U(14), 24]} /><Plastic />
          </mesh>
        ))}
        {/* 2 cặp mấu nhỏ giữ bìa ở cạnh phải (mặt trong nắp) */}
        {[-1, 1].flatMap((k) => [U(22), U(38)].map((z) => (
          <RoundedBox key={`t${k}${z}`} args={[U(5), U(1), U(6)]} radius={U(0.35)} smoothness={2} position={[CW - RIM_T - U(2.5), -LID_T - U(0.9), k * z]} castShadow><Plastic /></RoundedBox>
        )))}
        {/* bìa trước kẹp dưới mấu, lệch khỏi mặt nắp 0.2 mm */}
        {hasFront && (
          <group position={[CW - RIM_T - U(0.5) - COVER / 2, -LID_T - U(0.2), 0]}>
            <Sheet w={COVER} h={COVER} map={fOut} face="up" position={[0, 0, 0]} finish={finish} />
            {/* mặt trong: đọc như trang trái của sách khi mở nắp */}
            <Sheet w={COVER} h={COVER} map={fIn} face="down" position={[0, -0.004, 0]} />
          </group>
        )}
      </group>
    </group>
  );
}

// ---------- hộp từ mô hình .glb (dán ảnh theo tên mesh, dùng UV của model) ----------
function GlbCase({ url, images, finish, open, lifted, onToggleOpen, onToggleLift }: {
  url: string; images: Cd3DImages; finish: CoverFinish; open: boolean; lifted: boolean; onToggleOpen: () => void; onToggleLift: () => void;
}) {
  const gltf = useGLTF(url);
  const root = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const nodes = useMemo(() => {
    const m: Record<string, THREE.Object3D> = {};
    root.traverse((o) => { if (o.name) m[o.name] = o; (o as THREE.Mesh).castShadow = true; (o as THREE.Mesh).receiveShadow = true; });
    return m;
  }, [root]);
  const base = useRef({ hinge: 0, discY: { top: 0, bottom: 0 } });
  useEffect(() => {
    base.current.hinge = nodes[GLB_HINGE]?.rotation.z ?? 0;
    base.current.discY = { top: nodes.disc_top?.position.y ?? 0, bottom: nodes.disc_bottom?.position.y ?? 0 };
  }, [nodes]);

  // dán ảnh vào mesh giấy / đĩa (glTF: flipY = false)
  useEffect(() => {
    const put = (name: string, img: Src, aspect: number, outer = false) => {
      const mesh = nodes[name] as THREE.Mesh | undefined;
      if (!mesh || !(mesh as THREE.Mesh).isMesh || img === undefined) return;
      const gloss = outer && finish === "gloss";
      mesh.material = new THREE.MeshPhysicalMaterial({
        map: img ? tex(coverCrop(img, aspect, 2048), false) : null, color: "#ffffff",
        roughness: gloss ? 0.25 : 0.65, clearcoat: gloss ? 0.5 : 0, normalMap: paperNormal(), normalScale: new THREE.Vector2(0.12, 0.12), sheen: 0.25,
      });
    };
    put("front_cover_outer", images.frontOut, 1, true);
    put("front_cover_inner", images.frontIn, 1);
    put("back_card_outer", images.backOut, TRAY_W_MM / TRAY_H_MM, true);
    put("back_card_inner", images.backIn, TRAY_W_MM / TRAY_H_MM);
    const dTop = nodes.disc_top as THREE.Mesh | undefined;
    if (dTop?.isMesh) dTop.material = new THREE.MeshPhysicalMaterial({ map: images.disc ? tex(coverCrop(images.disc, 1, 1600), false) : null, color: "#ffffff", roughness: 0.45 });
    const dBot = nodes.disc_bottom as THREE.Mesh | undefined;
    if (dBot?.isMesh) dBot.material = new THREE.MeshPhysicalMaterial({ color: "#ffffff", map: discRings(), metalness: 1, roughness: 0.15, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [200, 800], iridescenceThicknessMap: discRings() });
    for (const n of ["lid", "base"]) { const m = nodes[n] as THREE.Mesh | undefined; if (m?.isMesh) m.material = plasticMaterial(); }
  }, [nodes, images, finish]);

  const anim = useRef({ lid: 0, lift: 0 });
  useFrame((_, dt) => {
    const a = anim.current;
    a.lid = THREE.MathUtils.clamp(a.lid + (open ? 1 : -1) * (dt / 0.8), 0, 1);
    a.lift = THREE.MathUtils.clamp(a.lift + (lifted ? 1 : -1) * (dt / 0.6), 0, 1);
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const h = nodes[GLB_HINGE];
    if (h) h.rotation.z = base.current.hinge + ease(a.lid) * OPEN_ANGLE;
    if (nodes.disc_top) nodes.disc_top.position.y = base.current.discY.top + ease(a.lift) * U(15);
    if (nodes.disc_bottom) nodes.disc_bottom.position.y = base.current.discY.bottom + ease(a.lift) * U(15);
  });
  const isDisc = (o: THREE.Object3D | null): boolean => !!o && (o.name === "disc_top" || o.name === "disc_bottom" || isDisc(o.parent));
  return (
    <primitive object={root}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (open && isDisc(e.object)) onToggleLift(); else onToggleOpen(); }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }} />
  );
}

// model lỗi → quay về hộp tự dựng
class Fallback extends Component<{ fallback: ReactNode; children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

// ---------- camera: góc chụp sản phẩm, lắc nhẹ khi rảnh, nâng / lùi khi mở nắp ----------
function CameraRig({ open, idle }: { open: boolean; idle: React.MutableRefObject<boolean> }) {
  const { camera } = useThree();
  const s = useRef({ r: VIEW.closed.r, elev: VIEW.closed.elev, t: 0 });
  useFrame((_, dt) => {
    if (!idle.current) return; // khách đã tự xoay → không điều khiển camera nữa
    const c = s.current, goal = open ? VIEW.open : VIEW.closed;
    c.r = THREE.MathUtils.damp(c.r, goal.r, 7, dt); // ~0.6 s
    c.elev = THREE.MathUtils.damp(c.elev, goal.elev, 7, dt);
    c.t += dt * 0.4;
    const az = VIEW.az + Math.sin(c.t) * 25; // lắc qua lại ±25°
    camera.position.copy(camAt(c.r, c.elev, az));
    camera.lookAt(TARGET0);
  });
  return null;
}

// chụp ảnh góc nhìn hiện tại ở độ phân giải cao (render qua composer để có hậu kỳ)
function Capturer({ handle, composer }: { handle: React.MutableRefObject<Cd3DHandle | null>; composer: React.MutableRefObject<ComposerImpl | null> }) {
  const { gl, scene, camera, size } = useThree();
  useEffect(() => {
    handle.current = {
      capture: (longSide) => {
        const pr = gl.getPixelRatio();
        const k = longSide / Math.max(size.width, size.height);
        gl.setPixelRatio(k);
        const comp = composer.current;
        if (comp) { comp.setSize(size.width, size.height); comp.render(); } else gl.render(scene, camera);
        const out = document.createElement("canvas");
        out.width = gl.domElement.width; out.height = gl.domElement.height;
        out.getContext("2d")!.drawImage(gl.domElement, 0, 0);
        gl.setPixelRatio(pr);
        if (comp) { comp.setSize(size.width, size.height); comp.render(); } else gl.render(scene, camera);
        return out;
      },
    };
    return () => { handle.current = null; };
  }, [gl, scene, camera, size, handle, composer]);
  return null;
}

// nền đang chọn vẽ thẳng vào cảnh (canvas đục) — để hậu kỳ không làm xám vùng nền như khi canvas trong suốt
function SceneBg({ url }: { url?: string }) {
  const { scene } = useThree();
  useEffect(() => {
    if (!url) { scene.background = new THREE.Color("#f4f4f5"); return; }
    let t: THREE.Texture | null = null, off = false;
    new THREE.TextureLoader().load(url, (tx) => { if (off) { tx.dispose(); return; } tx.colorSpace = THREE.SRGBColorSpace; t = tx; scene.background = tx; });
    return () => { off = true; t?.dispose(); };
  }, [url, scene]);
  return null;
}

// môi trường studio: HDRI trong public/hdri nếu có, không thì Lightformer tự dựng (dải phản chiếu dài trên nhựa)
function Studio({ hdr }: { hdr: boolean }) {
  if (hdr) return <Environment files={HDRI} environmentIntensity={0.9} />;
  return (
    <Environment resolution={512} environmentIntensity={0.9}>
      <Lightformer form="rect" intensity={4} position={[0, 14, 0]} rotation-x={Math.PI / 2} scale={[24, 12, 1]} />
      <Lightformer form="rect" intensity={2.2} position={[-16, 5, 0]} rotation-y={Math.PI / 2} scale={[3, 18, 1]} />
      <Lightformer form="rect" intensity={2.2} position={[16, 5, 0]} rotation-y={-Math.PI / 2} scale={[3, 18, 1]} />
      <Lightformer form="rect" intensity={0.6} position={[0, 4, 18]} scale={[14, 6, 1]} />
    </Environment>
  );
}

export default function Cd3D({ images, tray, finish = "matte", modelUrl, bgUrl, handle }: {
  images: Cd3DImages; tray: TrayStyle; finish?: CoverFinish; modelUrl?: string | null; bgUrl?: string; handle: React.MutableRefObject<Cd3DHandle | null>;
}) {
  const [open, setOpen] = useState(false);
  const [lifted, setLifted] = useState(false);
  const [touched, setTouched] = useState(false);
  const [low, setLow] = useState(() => typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768));
  const [hdr, setHdr] = useState(false);
  const idle = useRef(true);
  const controls = useRef<OrbitImpl | null>(null);
  const composer = useRef<ComposerImpl | null>(null);

  // có file HDRI studio trong public/hdri/ thì dùng
  useEffect(() => {
    let off = false;
    fetch(HDRI, { method: "HEAD" }).then((r) => { if (!off) setHdr(r.ok && !/text\/html/.test(r.headers.get("content-type") ?? "")); }).catch(() => {});
    return () => { off = true; };
  }, []);

  const toggleOpen = () => { setOpen((v) => { if (v) setLifted(false); return !v; }); };
  const reset = () => { idle.current = true; setTouched(false); };
  const first = () => { setTouched(true); };
  const start = () => { first(); idle.current = false; };

  const caseProps = { images, finish, open, lifted, onToggleOpen: toggleOpen, onToggleLift: () => setLifted((v) => !v) };
  const built = <BuiltCase {...caseProps} tray={tray} />;
  const p0 = camAt(VIEW.closed.r, VIEW.closed.elev, VIEW.az);

  return (
    <div className="absolute inset-0" onPointerDown={first} onWheel={first}>
      <Canvas shadows dpr={low ? 1 : [1, 2]} gl={{ alpha: false, antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: p0.toArray(), fov: FOV, near: 1, far: 400 }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.NoToneMapping; }}>
        <SceneBg url={bgUrl} />
        <PerformanceMonitor onDecline={() => setLow(true)} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[12, 26, 14]} intensity={2} castShadow shadow-mapSize={[2048, 2048]} shadow-radius={10} shadow-bias={-0.0004}
          shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} />
        <Suspense fallback={null}>
          <Studio hdr={hdr} />
        </Suspense>
        <group rotation={[0, -0.18, 0]}>
          {modelUrl ? (
            <Fallback fallback={built}><Suspense fallback={null}><GlbCase url={modelUrl} {...caseProps} /></Suspense></Fallback>
          ) : built}
        </group>
        {/* bóng đổ mềm dưới hộp (động: đổi theo nắp mở / đĩa nhấc) */}
        <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={30} blur={2.4} far={4} resolution={low ? 512 : 1024} color="#1f1f23" depthWrite={false} />
        <OrbitControls ref={controls as never} makeDefault enablePan={false} target={TARGET0.toArray()} minDistance={24} maxDistance={90}
          minPolarAngle={0.12} maxPolarAngle={Math.PI * 0.62} onStart={start} />
        <CameraRig open={open} idle={idle} />
        {/* hậu kỳ: SMAA + vignette rất nhẹ, không bloom.
            Không dùng N8AO: nó tự dựng lại độ sâu của cả tấm hứng bóng (rộng gấp 3 hộp) nên phủ 1 vùng tối hình vuông lên nền. */}
        <EffectComposer ref={composer as never} multisampling={low ? 0 : 4} enableNormalPass={false}>
          <SMAA />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          <Vignette offset={0.35} darkness={0.18} />
        </EffectComposer>
        <Capturer handle={handle} composer={composer} />
      </Canvas>

      {!touched && (
        <p className="pointer-events-none absolute bottom-3 left-3 rounded-[6px] bg-white/70 px-2 py-1 text-[12px] text-[#52525b]">
          Kéo để xoay · Cuộn để phóng to · Bấm vào hộp để mở
        </p>
      )}
      <div className="absolute bottom-3 right-3 flex gap-1.5">
        <button type="button" onClick={reset} title="Đặt lại góc nhìn" aria-label="Đặt lại góc nhìn"
          className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#18181b] shadow-[0_1px_4px_rgba(0,0,0,0.18)]"><RotateCcw size={15} /></button>
        <button type="button" onClick={() => { first(); toggleOpen(); }} title={open ? "Đóng hộp" : "Mở hộp"} aria-label={open ? "Đóng hộp" : "Mở hộp"}
          className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#18181b] shadow-[0_1px_4px_rgba(0,0,0,0.18)]"><BookOpen size={15} /></button>
      </div>
    </div>
  );
}
