import type { ReactNode } from "react";

type PanelVariant = "cyan" | "pink" | "violet";

type PanelProps = {
  children: ReactNode;
  variant?: PanelVariant;
  className?: string;
};

const variantClasses: Record<PanelVariant, string> = {
  cyan:
    "border-cyan-300/40 shadow-[0_0_28px_rgba(34,211,238,0.18)]",
  pink:
    "border-pink-300/50 shadow-[0_0_30px_rgba(236,72,153,0.22)]",
  violet:
    "border-violet-300/40 shadow-[0_0_28px_rgba(139,92,246,0.18)]",
};

export default function Panel({
  children,
  variant = "cyan",
  className = "",
}: PanelProps) {
  return (
    <div
      className={`border bg-[#071025]/75 p-5 backdrop-blur ${variantClasses[variant]} ${className}`}
    >
      {children}
    </div>
  );
}