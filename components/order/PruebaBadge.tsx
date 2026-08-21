type PruebaBadgeProps = {
  className?: string;
};

export function PruebaBadge({ className = "" }: PruebaBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${className}`.trim()}
      style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
    >
      PRUEBA
    </span>
  );
}
