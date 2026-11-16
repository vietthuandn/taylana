"use client";

export function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="pop-sm inline-flex items-center overflow-hidden rounded-full bg-white">
      <button type="button" aria-label="Giảm" className="h-10 w-10 text-xl hover:bg-pink-100 disabled:opacity-40"
        disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span className="w-9 text-center font-display text-lg">{value}</span>
      <button type="button" aria-label="Tăng" className="h-10 w-10 text-xl hover:bg-pink-100 disabled:opacity-40"
        disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}
