// Con số nổi bật (dark = đặt trên nền đen)
export function Stat({ value, label, dark = false }: { value: string; label: string; dark?: boolean }) {
  return (
    <div>
      <p className="font-display text-6xl leading-none text-hot-500 sm:text-7xl lg:text-8xl">{value}</p>
      <p className={`mt-2 font-semibold ${dark ? "text-white" : "text-ink-900"}`}>{label}</p>
    </div>
  );
}
