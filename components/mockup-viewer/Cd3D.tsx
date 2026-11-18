"use client";

/* Thẻ "3D" ở trang Xem Mockup: hộp CD jewel case dựng bằng code (three + @react-three/fiber + drei), kích thước thật (lib/cdSpecs).
   Chỉ tải khi khách chọn thẻ 3D (next/dynamic, ssr: false). Đơn vị trong cảnh: 1 = 10 mm.
   Trục: X = chiều rộng (bản lề bên trái, x âm) · Y = chiều dày (hướng lên) · Z = chiều cao bìa (mép trên ở z âm). */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitImpl } from "three-stdlib";
import { BookOpen, RotateCcw } from "lucide-react";
import {
  CASE_H_MM, CASE_T_MM, CASE_W_MM, COVER3D_MM, DISC3D_D_MM, DISC3D_HOLE_MM, DISC3D_T_MM,
  TRAY_FLOOR_MM, TRAY_H_MM, TRAY_SPINE_MM, TRAY_W_MM,
} from "@/lib/cdSpecs";
import { coverCrop } from "@/lib/mockup/coverCrop";
import type { TrayStyle } from "@/lib/mockup/types";

const U = (mm: number) => mm / 10;
const CW = U(CASE_W_MM), CH = U(CASE_H_MM), CT = U(CASE_T_MM);
const COVER = U(COVER3D_MM), TW = U(TRAY_FLOOR_MM), TH = U(TRAY_H_MM), SP = U(TRAY_SPINE_MM);
const DR = U(DISC3D_D_MM) / 2, DT = U(DISC3D_T_MM), DH = U(DISC3D_HOLE_MM) / 2;
const PLATE = 0.12; // độ dày tấm nhựa
const OPEN_ANGLE = (110 * Math.PI) / 180;
const CAM0 = new THREE.Vector3(15, 17, 21);
const TARGET0 = new THREE.Vector3(0, CT / 2, 0);

type Src = HTMLImageElement | null | undefined;
/** Ảnh của gói: undefined = không có giấy này · null = có giấy nhưng chưa có ảnh (giấy trắng) */
export type Cd3DImages = { frontOut?: Src; frontIn?: Src; backOut?: Src; backIn?: Src; disc?: Src };
export type Cd3DHandle = { capture: (longSide: number) => HTMLCanvasElement | null };

// ---------- texture ----------
function tex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
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
function Plastic() {
  return <meshPhysicalMaterial color="#ffffff" transmission={0.95} roughness={0.05} thickness={0.15} ior={1.5} clearcoat={1} clearcoatRoughness={0.05} metalness={0} />;
}
function Paper({ map }: { map: THREE.Texture | null }) {
  return <meshStandardMaterial key={map ? map.uuid : "white"} map={map} color="#ffffff" roughness={0.8} metalness={0} />;
}

// 1 mặt giấy (plane 1 mặt). face: "up" (nhìn từ trên, mép trên ảnh ở z âm) · "down" (nhìn từ dưới) · "+x" / "-x" (đứng ở cạnh bên)
function Sheet({ w, h, map, face, position }: { w: number; h: number; map: THREE.Texture | null; face: "up" | "down" | "+x" | "-x"; position: [number, number, number] }) {
  const rot: [number, number, number] = face === "up" ? [-Math.PI / 2, 0, 0] : face === "down" ? [Math.PI / 2, 0, 0] : [0, face === "+x" ? Math.PI / 2 : -Math.PI / 2, 0];
  const mesh = (
    <mesh rotation={rot} castShadow receiveShadow>
      <planeGeometry args={[w, h]} />
      <Paper map={map} />
    </mesh>
  );
  // mặt nhìn từ dưới: quay thêm 180° quanh Y để ảnh không bị ngược (mép trên vẫn ở z âm)
  return <group position={position} rotation={face === "down" ? [0, Math.PI, 0] : [0, 0, 0]}>{mesh}</group>;
}

// ---------- đĩa CD ----------
function Disc({ img }: { img: Src }) {
  const map = useMemo(() => (img ? tex(coverCrop(img, 1, 1600)) : null), [img]);
  const printIn = U(23) / 2, printOut = DR - 0.1; // vùng in (lỗ in 23 mm), chừa vành nhựa trong ở mép và quanh lỗ
  return (
    <group>
      {/* mặt in */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, DT / 2 + 0.001, 0]} castShadow receiveShadow>
        <ringGeometry args={[printIn, printOut, 128, 1]} />
        <meshStandardMaterial key={map ? map.uuid : "w"} map={map} color="#ffffff" roughness={0.5} metalness={0} />
      </mesh>
      {/* vành nhựa trong quanh lỗ và ở mép */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, DT / 2, 0]}><ringGeometry args={[DH, printIn, 64]} /><Plastic /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, DT / 2, 0]}><ringGeometry args={[printOut, DR, 128]} /><Plastic /></mesh>
      {/* mặt dưới bạc + ánh cầu vồng */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -DT / 2, 0]} castShadow>
        <ringGeometry args={[DH, DR, 128]} />
        <meshPhysicalMaterial color="#d9dbe0" metalness={1} roughness={0.22} iridescence={1} iridescenceIOR={1.3} iridescenceThicknessRange={[200, 800]} side={THREE.FrontSide} />
      </mesh>
      {/* cạnh đĩa + cạnh lỗ */}
      <mesh castShadow><cylinderGeometry args={[DR, DR, DT, 128, 1, true]} /><Plastic /></mesh>
      <mesh><cylinderGeometry args={[DH, DH, DT, 48, 1, true]} /><meshStandardMaterial color="#e5e7eb" side={THREE.BackSide} /></mesh>
    </group>
  );
}

// ---------- hộp ----------
function CaseModel({ images, tray, open, lifted, onToggleOpen, onToggleLift }: {
  images: Cd3DImages; tray: TrayStyle; open: boolean; lifted: boolean; onToggleOpen: () => void; onToggleLift: () => void;
}) {
  const lid = useRef<THREE.Group>(null);
  const disc = useRef<THREE.Group>(null);
  const anim = useRef({ lid: 0, lift: 0 });
  const wallH = CT - PLATE - 0.02;
  const DISC_Y = PLATE + 0.32 + DT / 2; // đĩa nằm trên khay

  // texture giấy (cập nhật ngay khi đổi ảnh — không dựng lại cảnh)
  const fOut = useMemo(() => (images.frontOut ? tex(coverCrop(images.frontOut, 1, 2048)) : null), [images.frontOut]);
  const fIn = useMemo(() => (images.frontIn ? tex(coverCrop(images.frontIn, 1, 2048)) : null), [images.frontIn]);
  const bOut = useMemo(() => (images.backOut ? splitTray(images.backOut) : null), [images.backOut]);
  const bIn = useMemo(() => (images.backIn ? splitTray(images.backIn) : null), [images.backIn]);
  const bOutT = useMemo(() => (bOut ? { floor: tex(bOut.floor), l: tex(turn(bOut.left, true)), r: tex(turn(bOut.right, false)) } : null), [bOut]);
  const bInT = useMemo(() => (bIn ? { floor: tex(bIn.floor), l: tex(turn(bIn.left, true)), r: tex(turn(bIn.right, false)) } : null), [bIn]);
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

  return (
    <group>
      {/* ---------- ĐẾ ---------- */}
      <group onClick={(e) => { e.stopPropagation(); onToggleOpen(); }} onPointerOver={over} onPointerOut={out}>
        <mesh position={[0, PLATE / 2, 0]} castShadow receiveShadow><boxGeometry args={[CW, PLATE, CH]} /><Plastic /></mesh>
        {/* 2 gáy trái / phải + 2 thành trước / sau (nhựa trong) */}
        {[-1, 1].map((k) => (
          <mesh key={`s${k}`} position={[k * (CW / 2 - PLATE / 2), PLATE + wallH / 2 - 0.01, 0]} castShadow><boxGeometry args={[PLATE, wallH, CH]} /><Plastic /></mesh>
        ))}
        {[-1, 1].map((k) => (
          <mesh key={`f${k}`} position={[0, PLATE + 0.2, k * (CH / 2 - PLATE / 2)]} castShadow><boxGeometry args={[CW - PLATE * 2, 0.4, PLATE]} /><Plastic /></mesh>
        ))}
        {/* bìa sau: đáy 138 + 2 gáy 6 mm gập vuông góc lên 2 cạnh bên */}
        {hasBack && (
          <group>
            <Sheet w={TW} h={TH} map={bOutT?.floor ?? null} face="down" position={[0, PLATE + 0.004, 0]} />
            <Sheet w={TW} h={TH} map={bInT?.floor ?? null} face="up" position={[0, PLATE + 0.008, 0]} />
            {/* nhìn từ dưới, mép trái ảnh ở x dương → gáy trái của ảnh nằm ở cạnh +x */}
            <Sheet w={TH} h={SP} map={bOutT?.l ?? null} face="+x" position={[TW / 2 + 0.003, PLATE + SP / 2, 0]} />
            <Sheet w={TH} h={SP} map={bOutT?.r ?? null} face="-x" position={[-TW / 2 - 0.003, PLATE + SP / 2, 0]} />
            {/* mặt trong (nhìn từ trên): gáy trái ở cạnh -x */}
            <Sheet w={TH} h={SP} map={bInT?.l ?? null} face="+x" position={[-TW / 2 + 0.003, PLATE + SP / 2, 0]} />
            <Sheet w={TH} h={SP} map={bInT?.r ?? null} face="-x" position={[TW / 2 - 0.003, PLATE + SP / 2, 0]} />
          </group>
        )}
        {/* khay giữ đĩa */}
        <mesh position={[0, PLATE + 0.16, 0]} receiveShadow castShadow>
          <boxGeometry args={[TW - 0.3, 0.06, TH - 0.3]} />
          {tray === "black" ? <meshStandardMaterial color="#141416" roughness={0.45} /> : <Plastic />}
        </mesh>
        <mesh position={[0, PLATE + 0.3, 0]} castShadow>
          <cylinderGeometry args={[DH - 0.05, DH, 0.3, 32]} />
          {tray === "black" ? <meshStandardMaterial color="#141416" roughness={0.45} /> : <Plastic />}
        </mesh>
      </group>

      {/* ---------- ĐĨA ---------- */}
      <group ref={disc} position={[0, DISC_Y, 0]}
        onClick={(e) => { e.stopPropagation(); if (open) onToggleLift(); else onToggleOpen(); }} onPointerOver={over} onPointerOut={out}>
        <Disc img={images.disc ?? null} />
      </group>

      {/* ---------- NẮP (bản lề cạnh trái) ---------- */}
      <group ref={lid} position={[-CW / 2, CT, 0]} onClick={(e) => { e.stopPropagation(); onToggleOpen(); }} onPointerOver={over} onPointerOut={out}>
        <mesh position={[CW / 2, -PLATE / 2, 0]} castShadow receiveShadow><boxGeometry args={[CW, PLATE, CH]} /><Plastic /></mesh>
        <mesh position={[CW - PLATE / 2, -0.2, 0]} castShadow><boxGeometry args={[PLATE, 0.28, CH - 0.4]} /><Plastic /></mesh>
        {/* 2 mấu giữ bìa */}
        {[-1, 1].map((k) => (
          <mesh key={k} position={[CW - 0.75, -PLATE - 0.05, k * 3.2]} castShadow><boxGeometry args={[0.7, 0.1, 1.4]} /><Plastic /></mesh>
        ))}
        {hasFront && (
          <group position={[CW - 0.35 - COVER / 2, -PLATE - 0.004, 0]}>
            <Sheet w={COVER} h={COVER} map={fOut} face="up" position={[0, 0, 0]} />
            {/* mặt trong: đọc như trang trái của sách khi mở nắp */}
            <Sheet w={COVER} h={COVER} map={fIn} face="down" position={[0, -0.004, 0]} />
          </group>
        )}
      </group>
    </group>
  );
}

// chụp ảnh góc nhìn hiện tại ở độ phân giải cao
function Capturer({ handle }: { handle: React.MutableRefObject<Cd3DHandle | null> }) {
  const { gl, scene, camera, size } = useThree();
  useEffect(() => {
    handle.current = {
      capture: (longSide) => {
        const pr = gl.getPixelRatio();
        gl.setPixelRatio(longSide / Math.max(size.width, size.height));
        gl.render(scene, camera);
        const out = document.createElement("canvas");
        out.width = gl.domElement.width; out.height = gl.domElement.height;
        out.getContext("2d")!.drawImage(gl.domElement, 0, 0);
        gl.setPixelRatio(pr);
        gl.render(scene, camera);
        return out;
      },
    };
    return () => { handle.current = null; };
  }, [gl, scene, camera, size, handle]);
  return null;
}

export default function Cd3D({ images, tray, handle }: { images: Cd3DImages; tray: TrayStyle; handle: React.MutableRefObject<Cd3DHandle | null> }) {
  const [open, setOpen] = useState(false);
  const [lifted, setLifted] = useState(false);
  const [touched, setTouched] = useState(false);
  const [auto, setAuto] = useState(true);
  const controls = useRef<OrbitImpl | null>(null);
  const toggleOpen = () => { setOpen((v) => { if (v) setLifted(false); return !v; }); };
  const reset = () => {
    const c = controls.current;
    if (!c) return;
    c.object.position.copy(CAM0); c.target.copy(TARGET0); c.update();
  };
  const first = () => { setTouched(true); setAuto(false); };

  return (
    <div className="absolute inset-0" onPointerDown={first} onWheel={first}>
      <Canvas shadows dpr={[1, 2]} gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: CAM0.toArray(), fov: 32, near: 0.5, far: 300 }} onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[10, 24, 12]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-radius={6} shadow-bias={-0.0004}
          shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} />
        {/* môi trường kiểu studio (dựng tại chỗ, không tải file ngoài), cường độ thấp */}
        <Environment resolution={256} environmentIntensity={0.6}>
          <Lightformer form="rect" intensity={3} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[20, 10, 1]} />
          <Lightformer form="rect" intensity={1.5} position={[-12, 4, 6]} rotation-y={Math.PI / 2} scale={[10, 6, 1]} />
          <Lightformer form="rect" intensity={1.5} position={[12, 4, -6]} rotation-y={-Math.PI / 2} scale={[10, 6, 1]} />
          <Lightformer form="ring" intensity={1} position={[0, 6, 14]} scale={6} />
        </Environment>
        <group rotation={[0, -0.18, 0]}>
          <CaseModel images={images} tray={tray} open={open} lifted={lifted} onToggleOpen={toggleOpen} onToggleLift={() => setLifted((v) => !v)} />
        </group>
        <ContactShadows position={[0, -0.01, 0]} opacity={0.35} scale={34} blur={2.6} far={6} />
        <OrbitControls ref={controls as never} makeDefault enablePan={false} target={TARGET0.toArray()} minDistance={14} maxDistance={60}
          minPolarAngle={0.12} maxPolarAngle={Math.PI * 0.62} autoRotate={auto} autoRotateSpeed={0.35} onStart={first} />
        <Capturer handle={handle} />
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
