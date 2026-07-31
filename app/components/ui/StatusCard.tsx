type StatusCardProps = {
  label: string;
  value: string;
  valueClassName?: string;
};

export default function StatusCard({
  label,
  value,
  valueClassName = "text-white",
}: StatusCardProps) {
  return (
    <div className="border border-white/10 bg-white/5 p-3">
      <p className="text-xs font-black tracking-[0.16em] text-cyan-200">
        {label}
      </p>

      <p className={`mt-2 break-words font-black ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}