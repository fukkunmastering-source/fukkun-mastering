type MeterBarVariant = "cyan" | "pink" | "violet" | "emerald";

type MeterBarProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  displayValue?: string;
  variant?: MeterBarVariant;
  className?: string;
};

const variantClasses: Record<MeterBarVariant, string> = {
  cyan: "bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.65)]",
  pink: "bg-pink-400 shadow-[0_0_14px_rgba(236,72,153,0.65)]",
  violet: "bg-violet-400 shadow-[0_0_14px_rgba(167,139,250,0.65)]",
  emerald: "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.65)]",
};

export default function MeterBar({
  label,
  value,
  min = 0,
  max = 100,
  displayValue,
  variant = "cyan",
  className = "",
}: MeterBarProps) {
  const safeMax = max === min ? min + 1 : max;
  const percentage = Math.min(
    100,
    Math.max(0, ((value - min) / (safeMax - min)) * 100)
  );

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-black tracking-[0.16em] text-cyan-100">
          {label}
        </p>

        <p className="text-sm font-black text-white">
          {displayValue ?? value}
        </p>
      </div>

      <div className="h-3 overflow-hidden border border-white/10 bg-black/35">
        <div
          className={`h-full transition-[width] duration-500 ${variantClasses[variant]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}