export function Stars({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`tracking-wider ${className}`} aria-label={`${value} sao`}>
      <span className="text-hot-500">{"★".repeat(value)}</span>
      <span className="text-ink-100">{"★".repeat(5 - value)}</span>
    </span>
  );
}
