export function Stars({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`tracking-wider ${className}`} aria-label={`${value} sao`}>
      <span className="text-pink-400">{"★".repeat(value)}</span>
      <span className="text-cocoa-300">{"★".repeat(5 - value)}</span>
    </span>
  );
}
