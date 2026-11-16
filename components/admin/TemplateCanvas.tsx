"use client";

/* Canvas kéo thả để admin tạo các ô đặt ảnh trên mẫu. */
import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Ellipse, Text, Image as KImage, Transformer, Group, Circle } from "react-konva";
import type Konva from "konva";
import type { PrintSpec } from "@/lib/print";
import type { Slot } from "@/lib/templates";
import { useView } from "@/components/designer/smoothImage";

function useImg(src?: string | null) {
  const [img, setImg] = useState<HTMLImageElement>();
  useEffect(() => {
    if (!src) return setImg(undefined);
    const i = new window.Image();
    i.crossOrigin = "anonymous";
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);
  return img;
}

export function TemplateCanvas({ spec, width, overlay, background, bgColor, slots, onChange, selectedId, onSelect, overlayOpacity }: {
  spec: PrintSpec; width: number; overlay?: string | null; background?: string | null; bgColor?: string;
  slots: Slot[]; onChange: (s: Slot[]) => void; selectedId: string | null; onSelect: (id: string | null) => void; overlayOpacity: number;
}) {
  const W = width, H = width * (spec.h / spec.w);
  const ovFull = useImg(overlay);
  const bgFull = useImg(background);
  // bản thu nhỏ mịn để hiển thị (tránh răng cưa khi ảnh gốc rất lớn)
  const ovView = useView(ovFull, Math.max(W, H));
  const bgView = useView(bgFull, Math.max(W, H));
  const ov = ovFull && ovView ? { img: ovView } : undefined;
  const bg = bgFull && bgView ? { img: bgView, w: bgFull.naturalWidth, h: bgFull.naturalHeight } : undefined;
  const trRef = useRef<Konva.Transformer>(null);
  const stageRef = useRef<Konva.Stage>(null);

  useEffect(() => {
    const node = selectedId ? stageRef.current?.findOne(`#s-${selectedId}`) : null;
    trRef.current?.nodes(node ? [node] : []);
    trRef.current?.getLayer()?.batchDraw();
  }, [selectedId, slots]);

  const update = (id: string, p: Partial<Slot>) => onChange(slots.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const isDisc = spec.shape === "disc";

  return (
    <Stage ref={stageRef} width={W} height={H}
      onMouseDown={(e) => { if (e.target === e.target.getStage() || e.target.name() === "bg") onSelect(null); }}
      onTouchStart={(e) => { if (e.target === e.target.getStage() || e.target.name() === "bg") onSelect(null); }}
      className="pop-sm bg-white">
      <Layer>
        <Rect name="bg" width={W} height={H} fill={bgColor || "#ffffff"} />
        {bg && (() => {
          const k = Math.max(W / bg.w, H / bg.h);
          return <KImage name="bg" image={bg.img} width={bg.w * k} height={bg.h * k} x={(W - bg.w * k) / 2} y={(H - bg.h * k) / 2} />;
        })()}
        {ov && <KImage image={ov.img} width={W} height={H} opacity={overlayOpacity} listening={false} />}
        {isDisc && (
          <Group listening={false}>
            <Circle x={W / 2} y={W / 2} radius={W / 2} stroke="#141414" strokeWidth={1.5} />
            <Circle x={W / 2} y={W / 2} radius={(spec.hole! / 2 / spec.w) * W} fill="#f7f0e6" stroke="#141414" strokeWidth={1} />
          </Group>
        )}

        {slots.map((s, i) => {
          const common = {
            id: `s-${s.id}`, draggable: true,
            onMouseDown: () => onSelect(s.id), onTouchStart: () => onSelect(s.id),
            onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
              const n = e.target;
              const x = s.shape === "circle" ? n.x() - (s.w * W) / 2 : n.x();
              const y = s.shape === "circle" ? n.y() - (s.h * H) / 2 : n.y();
              update(s.id, { x: x / W, y: y / H });
            },
            onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
              const n = e.target;
              const sx = n.scaleX(), sy = n.scaleY();
              n.scaleX(1); n.scaleY(1);
              if (s.shape === "circle") {
                const n2 = n as Konva.Ellipse;
                const rw = n2.radiusX() * sx, rh = n2.radiusY() * sy;
                update(s.id, { x: (n.x() - rw) / W, y: (n.y() - rh) / H, w: (rw * 2) / W, h: (rh * 2) / H });
              } else {
                const n2 = n as Konva.Rect;
                update(s.id, { x: n.x() / W, y: n.y() / H, w: (n2.width() * sx) / W, h: (n2.height() * sy) / H });
              }
            },
            fill: s.id === selectedId ? "rgba(123,104,238,0.45)" : "rgba(200,224,60,0.5)",
            stroke: "#141414", strokeWidth: 1.5, dash: [6, 4],
          };
          return (
            <Group key={s.id}>
              {s.shape === "circle" ? (
                <Ellipse {...common} x={(s.x + s.w / 2) * W} y={(s.y + s.h / 2) * H} radiusX={(s.w * W) / 2} radiusY={(s.h * H) / 2} />
              ) : (
                <Rect {...common} x={s.x * W} y={s.y * H} width={s.w * W} height={s.h * H} />
              )}
              <Text listening={false} text={String(i + 1)} x={s.x * W + 4} y={s.y * H + 4} fontSize={16} fontFamily="Itim" fill="#141414" />
            </Group>
          );
        })}
        <Transformer ref={trRef} rotateEnabled={false} keepRatio={false} anchorSize={12} anchorCornerRadius={6}
          borderStroke="#7b68ee" anchorStroke="#7b68ee" ignoreStroke
          boundBoxFunc={(oldB, newB) => (newB.width < 12 || newB.height < 12 ? oldB : newB)} />
      </Layer>
    </Stage>
  );
}
