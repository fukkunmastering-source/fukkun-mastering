import type { ButtonHTMLAttributes, ReactNode } from "react";

type CyberButtonVariant =
  | "cyan"
  | "pink"
  | "violet"
  | "ghostPink"
  | "targetSound";

type CyberButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: CyberButtonVariant;
  fullWidth?: boolean;
};

const variantClasses: Record<CyberButtonVariant, string> = {
  cyan: "border-cyan-200 bg-blue-600 shadow-[4px_4px_0_rgba(236,72,153,0.85),0_0_22px_rgba(37,99,235,0.5)] hover:bg-cyan-500",
  pink: "border-pink-200 bg-pink-600 shadow-[4px_4px_0_rgba(34,211,238,0.85),0_0_22px_rgba(236,72,153,0.55)] hover:bg-fuchsia-500",
  violet:
    "border-violet-200 bg-violet-600 shadow-[4px_4px_0_rgba(34,211,238,0.75),0_0_22px_rgba(139,92,246,0.5)] hover:bg-violet-500",
  ghostPink:
    "border-pink-300/50 bg-pink-500/10 text-pink-100 shadow-none hover:bg-pink-500/20",
  targetSound:
    "border-blue-300/40 bg-blue-500/10 text-cyan-100 shadow-[0_0_16px_rgba(59,130,246,0.14)] hover:border-pink-300 hover:bg-pink-500/15 hover:text-pink-100",
};

export default function CyberButton({
  children,
  variant = "cyan",
  fullWidth = false,
  className = "",
  type = "button",
  ...props
}: CyberButtonProps) {
  return (
    <button
      type={type}
      className={`border-2 px-6 py-3 font-black tracking-[0.18em] text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
        variantClasses[variant]
      } ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
