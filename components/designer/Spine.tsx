"use client";

/* Dải dọc trên bìa sau (gáy, Spine). Nội dung vẽ trong hệ toạ độ "nằm ngang"
   (dài = chiều cao bìa, rộng = độ rộng dải). Trên bìa:
   - dir "cw"  (gáy trái, Spine): xoay 90° theo chiều kim đồng hồ → đọc từ trên xuống, đầu chữ hướng sang phải
   - dir "ccw" (gáy phải): xoay 90° ngược chiều kim đồng hồ → đọc từ dưới lên, đầu chữ hướng sang trái
   Bìa, file xuất và chế độ sửa dùng chung đúng 1 phép xoay này. */
import { Group, Rect, Text, Stage, Layer, Line, Image as KImage } from "react-konva";

export type SpineText = {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number; // px bản in
  fill: string;
  align: "left" | "center" | "right";
  y: number; // vị trí theo bề ngang dải (px bản in)
};
export type SpineSide = { bg: string | null; texts: SpineText[] };
export const emptySide = (): SpineSide => ({ bg: null, texts: [] });
export const sideHasContent = (s: SpineSide | null | undefined) => !!s && (!!s.bg || s.texts.length > 0);

// side = nội dung chữ/màu (null = chỉ vẽ đường, không sửa)
export type Zone = { id: string; label: string; x: number; w: number; dir: "cw" | "ccw"; side: SpineSide | null };

// Phép đặt nội dung dải lên bìa (toạ độ bản in)
// đổi góc xoay (độ) → chiều: 90 = "cw", -90 = "ccw"
export const dirOf = (deg: number): "cw" | "ccw" => (deg === 90 ? "cw" : "ccw");

export const zonePlacement = (z: { x: number; w: number; dir: "cw" | "ccw" }, H: number) =>
  z.dir === "cw" ? { x: z.x + z.w, y: 0, rotation: 90 } : { x: z.x, y: H, rotation: -90 };

// Nội dung 1 dải (len = chiều dài, thick = độ rộng, đơn vị px bản in)
export function SpineContent({ side, len, thick, editable, selectedId, onSelect, onMoveText }: {
  side: SpineSide; len: number; thick: number; editable?: boolean;
  selectedId?: string | null; onSelect?: (id: string | null) => void; onMoveText?: (id: string, y: number) => void;
}) {
  const pad = thick * 0.15;
  return (
    <Group clipFunc={(ctx) => ctx.rect(0, 0, len, thick)}>
      {side.bg && <Rect width={len} height={thick} fill={side.bg} name="spine-bg" />}
      {editable && !side.bg && <Rect width={len} height={thick} fill="rgba(0,0,0,0)" name="spine-bg" />}
      {side.texts.map((t) => (
        <Text key={t.id} id={t.id} text={t.text} x={pad} y={t.y} width={len - pad * 2} align={t.align}
          fontFamily={t.fontFamily} fontSize={t.fontSize} fill={t.fill} wrap="none" ellipsis
          draggable={editable}
          onMouseDown={() => onSelect?.(t.id)} onTouchStart={() => onSelect?.(t.id)}
          onDragMove={(e) => e.target.x(pad)}
          onDragEnd={(e) => onMoveText?.(t.id, e.target.y())}
          stroke={editable && selectedId === t.id ? "#ff5fa2" : undefined} strokeWidth={0} />
      ))}
    </Group>
  );
}

// Canvas sửa dải: nằm ngang, phóng to vừa chiều rộng vùng làm việc.
// bg = ảnh phần thiết kế đang nằm dưới dải (cắt từ trang), xoay về cùng chiều để thấy bối cảnh — chỉ xem.
export function SpineEditor({ side, len, thick, width, dir, bg, selectedId, onSelect, onMoveText }: {
  side: SpineSide; len: number; thick: number; width: number; dir: "cw" | "ccw";
  bg?: HTMLCanvasElement | null;
  selectedId: string | null; onSelect: (id: string | null) => void; onMoveText: (id: string, y: number) => void;
}) {
  const k = width / len;
  const sel = side.texts.find((t) => t.id === selectedId);
  // ảnh vùng (rộng thick × cao len, toạ độ bìa) → hệ toạ độ dải: ngược với phép đặt lên bìa
  const bgPlace = dir === "cw" ? { x: 0, y: thick, rotation: -90 } : { x: len, y: 0, rotation: 90 };
  return (
    <Stage width={width} height={thick * k} scaleX={k} scaleY={k}
      onMouseDown={(e) => { if (e.target === e.target.getStage() || e.target.name() === "spine-bg" || e.target.name() === "ctx") onSelect(null); }}
      onTouchStart={(e) => { if (e.target === e.target.getStage() || e.target.name() === "spine-bg" || e.target.name() === "ctx") onSelect(null); }}
      style={{ background: "#fff" }}>
      <Layer>
        {bg && (
          <Group {...bgPlace} listening={false}>
            <KImage image={bg} width={thick} height={len} name="ctx" />
          </Group>
        )}
        <SpineContent side={side} len={len} thick={thick} editable selectedId={selectedId} onSelect={onSelect} onMoveText={onMoveText} />
        {sel && <Rect x={0} y={sel.y} width={len} height={sel.fontSize * 1.1} stroke="#ff5fa2" strokeWidth={2 / k} dash={[6 / k, 4 / k]} listening={false} />}
        <Line points={[0, 0, len, 0, len, thick, 0, thick, 0, 0]} stroke="#141414" strokeWidth={1.5 / k} dash={[8 / k, 6 / k]} listening={false} />
      </Layer>
    </Stage>
  );
}
