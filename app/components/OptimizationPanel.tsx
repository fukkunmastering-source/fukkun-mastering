import type { ComponentType } from "react";
import Panel from "./ui/Panel";
import MeterBar from "./ui/MeterBar";
type Analysis = {
  loudness: number;
  bass: number;
  treble: number;
  vocal: number;
  eqSuggestion?: string;
};

type OptimizationValue = {
  value: string;
  action: string;
};

type OptimizationPanelProps = {
  analysis: Analysis;
  getOptimizationValue: (score: number) => OptimizationValue;
  getLoudnessAdjustment: (loudness: number) => string;
  PixelRecord: ComponentType;
};

export default function OptimizationPanel({
  analysis,
  getOptimizationValue,
  getLoudnessAdjustment,
  PixelRecord,
}: OptimizationPanelProps) {
  const optimizationItems = [
    {
      label: "LOW END",
      subLabel: "低音（BASS）",
      value: getOptimizationValue(analysis.bass).value,
      action: getOptimizationValue(analysis.bass).action,
      score: analysis.bass,
      accentClass: "text-cyan-200",
      borderClass: "border-cyan-300/35",
      glowClass: "shadow-[0_0_20px_rgba(34,211,238,0.12)]",
      meterVariant: "cyan" as const,
      badgeClass: "border-cyan-300/40 bg-cyan-400/10 text-cyan-100",
    },
    {
      label: "VOCAL RANGE",
      subLabel: "声の聞こえやすさ（VOCAL）",
      value: getOptimizationValue(analysis.vocal).value,
      action: getOptimizationValue(analysis.vocal).action,
      score: analysis.vocal,
      accentClass: "text-violet-200",
      borderClass: "border-violet-300/35",
      glowClass: "shadow-[0_0_20px_rgba(167,139,250,0.12)]",
      meterVariant: "violet" as const,
      badgeClass: "border-violet-300/40 bg-violet-400/10 text-violet-100",
    },
    {
      label: "HIGH END",
      subLabel: "高音の抜け感（TREBLE）",
      value: getOptimizationValue(analysis.treble).value,
      action: getOptimizationValue(analysis.treble).action,
      score: analysis.treble,
      accentClass: "text-pink-200",
      borderClass: "border-pink-300/35",
      glowClass: "shadow-[0_0_20px_rgba(244,114,182,0.12)]",
      meterVariant: "pink" as const,
      badgeClass: "border-pink-300/40 bg-pink-400/10 text-pink-100",
    },
    {
      label: "STEREO IMAGE",
      subLabel: "音の広がり（SPACE）",
      value: "+2",
      action: "WIDEN",
      score: 64,
      accentClass: "text-blue-200",
      borderClass: "border-blue-300/35",
      glowClass: "shadow-[0_0_20px_rgba(96,165,250,0.12)]",
      meterVariant: "cyan" as const,
      badgeClass: "border-blue-300/40 bg-blue-400/10 text-blue-100",
    },
    {
      label: "OUTPUT LIMITER",
      subLabel: "音割れ防止（LIMITER）",
      value: "ACTIVE",
      action: "PROTECT",
      score: 92,
      accentClass: "text-emerald-200",
      borderClass: "border-emerald-300/35",
      glowClass: "shadow-[0_0_20px_rgba(110,231,183,0.12)]",
      meterVariant: "emerald" as const,
      badgeClass: "border-emerald-300/40 bg-emerald-400/10 text-emerald-100",
    },
  ];

  return (
    <Panel variant="cyan" className="lg:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-black tracking-[0.24em] text-cyan-200">
          OPTIMIZATION
        </h2>

        <span className="border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-xs font-black tracking-[0.18em] text-cyan-100">
          PROFILE GENERATED
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {optimizationItems.map((item, index) => (
          <div
            key={item.label}
            className={`relative overflow-hidden border bg-[#05091d]/90 p-4 ${item.borderClass} ${item.glowClass}`}
          >
            <div className="absolute right-0 top-0 h-8 w-8 border-b border-l border-white/10 bg-white/5" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black tracking-[0.22em] text-slate-500">
                  UNIT {String(index + 1).padStart(2, "0")}
                </p>

                <p className="mt-1 text-sm font-black tracking-[0.14em] text-white">
                  {item.label}
                </p>

                <p className="mt-1 text-xs font-bold text-cyan-100/65">
                  {item.subLabel}
                </p>
              </div>

              <div className="text-right">
                <p
                  className={`text-lg font-black tracking-[0.12em] ${item.accentClass}`}
                >
                  {item.value}
                </p>

                <span
                  className={`mt-2 inline-block border px-2 py-1 text-[10px] font-black tracking-[0.16em] ${item.badgeClass}`}
                >
                  {item.action}
                </span>
              </div>
            </div>

            <MeterBar
              label="INPUT LEVEL"
              value={item.score}
              displayValue={`${item.score}%`}
              variant={item.meterVariant}
              className="mt-5"
            />

            <div className="mt-4 grid grid-cols-8 gap-1 border-t border-white/10 pt-3">
              {Array.from({ length: 8 }).map((_, segmentIndex) => (
                <span
                  key={segmentIndex}
                  className={`h-1.5 ${
                    segmentIndex < Math.ceil(item.score / 12.5)
                      ? item.badgeClass
                      : "border border-slate-800 bg-slate-900"
                  }`}
                />
              ))}
            </div>
          </div>
        ))}

        <PixelRecord />
      </div>
      <div className="mt-4 border border-pink-300/30 bg-pink-500/10 p-4">
        <p className="text-xs font-black tracking-[0.2em] text-pink-200">
          MASTERING PROFILE
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center justify-between border border-white/10 bg-black/20 px-3 py-2">
            <span className="text-xs font-black tracking-[0.14em] text-violet-200">
              LOW END
            </span>

            <span className="font-black text-white">
              {getOptimizationValue(analysis.bass).value} dB
            </span>
          </div>

          <div className="flex items-center justify-between border border-white/10 bg-black/20 px-3 py-2">
            <span className="text-xs font-black tracking-[0.14em] text-violet-200">
              VOCAL
            </span>

            <span className="font-black text-white">
              {getOptimizationValue(analysis.vocal).value} dB
            </span>
          </div>

          <div className="flex items-center justify-between border border-white/10 bg-black/20 px-3 py-2">
            <span className="text-xs font-black tracking-[0.14em] text-violet-200">
              HIGH END
            </span>

            <span className="font-black text-white">
              {getOptimizationValue(analysis.treble).value} dB
            </span>
          </div>

          <div className="flex items-center justify-between border border-white/10 bg-black/20 px-3 py-2">
            <span className="text-xs font-black tracking-[0.14em] text-violet-200">
              LOUDNESS
            </span>

            <span className="font-black text-white">
              {getLoudnessAdjustment(analysis.loudness)}
            </span>
          </div>
        </div>

        <div className="mt-3 border border-white/10 bg-black/20 px-3 py-2">
          <p className="text-xs font-black tracking-[0.14em] text-cyan-200">
            ENGINE NOTE
          </p>

          <p className="mt-1 text-sm font-semibold text-white">
            {analysis.eqSuggestion}
          </p>
        </div>
      </div>
    </Panel>
  );
}
