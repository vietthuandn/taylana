"use client";

/* Gáy bìa sau: 2 dải ở mép trái & phải. Nội dung vẽ trong hệ toạ độ "nằm ngang"
   (dài = chiều cao bìa, rộng = độ rộng gáy). Trên bìa thì xoay 90° → chữ chạy dọc theo gáy. */
import { useEffect, useRef } from "react";
import { Group, Rect, Text, Stage, Layer, Line } from "react-konva";
import type Konva from "konva";

export type SpineText = {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number; // px bản in
  fill: string;
  align: "left" | "center" | "right";
  y: number; // vị trí theo bề ngang gáy (px bản in)
};
export type SpineSide = { bg: string | null; texts: SpineText[] };
export type SpineData = { left: SpineSide; right: SpineSide };
export const emptySpine = (): SpineData => ({ left: { bg: null, texts: [] }, right: { bg: null, texts: [] } });
export const hasSpineContent = (d: SpineData) => [d.left, d.right].some((s) => s.bg || s.texts.length);

// Nội dung 1 dải gáy (len = chiều dài gáy, thick = độ rộng gáy, đơn vị px bản in)
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
          stroke={editable && selectedId === t.id ? "#7b68ee" : undefined} strokeWidth={0} />
      ))}
    </Group>
  );
}

// Canvas sửa gáy: dải gáy nằm ngang, phóng to vừa chiều rộng vùng làm việc
export function SpineEditor({ side, len, thick, width, selectedId, onSelect, onMoveText }: {
  side: SpineSide; len: number; thick: number; width: number;
  selectedId: string | null; onSelect: (id: string | null) => void; onMoveText: (id: string, y: number) => void;
}) {
  const k = width / len;
  const stageRef = useRef<Konva.Stage>(null);
  const sel = side.texts.find((t) => t.id === selectedId);
  useEffect(() => { stageRef.current?.batchDraw(); }, [side]);
  return (
    <Stage ref={stageRef} width={width} height={thick * k} scaleX={k} scaleY={k}
      onMouseDown={(e) => { if (e.target === e.target.getStage() || e.target.name() === "spine-bg") onSelect(null); }}
      onTouchStart={(e) => { if (e.target === e.target.getStage() || e.target.name() === "spine-bg") onSelect(null); }}
      style={{ background: "#fff" }}>
      <Layer>
        <SpineContent side={side} len={len} thick={thick} editable selectedId={selectedId} onSelect={onSelect} onMoveText={onMoveText} />
        {sel && <Rect x={0} y={sel.y} width={len} height={sel.fontSize * 1.1} stroke="#7b68ee" strokeWidth={2 / k} dash={[6 / k, 4 / k]} listening={false} />}
        <Line points={[0, 0, len, 0, len, thick, 0, thick, 0, 0]} stroke="#141414" strokeWidth={1.5 / k} dash={[8 / k, 6 / k]} listening={false} />
      </Layer>
    </Stage>
  );
}
