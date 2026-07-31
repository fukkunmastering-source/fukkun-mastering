import Panel from "./ui/Panel";
import MeterBar from "./ui/MeterBar";
type Analysis = {
  loudness: number;
  bass: number;
  treble: number;
  vocal: number;
  recommendation: string;
  mastering: {
    dynamicEq: {
      threshold: number;
      range: number;
      attack: number;
      release: number;
    };
  };
};

type SystemAnalysisPanelProps = {
  analysis: Analysis;
};

export default function SystemAnalysisPanel({
  analysis,
}: SystemAnalysisPanelProps) {
  const analysisItems = [
    {
      label: "LOUDNESS",
      value: `${analysis.loudness} dB`,
      score: Math.min(
        100,
        Math.max(0, Math.round((analysis.loudness + 24) * 5)),
      ),
    },
    {
      label: "BASS",
      value: `${analysis.bass}%`,
      score: analysis.bass,
    },
    {
      label: "TREBLE",
      value: `${analysis.treble}%`,
      score: analysis.treble,
    },
    {
      label: "VOCAL",
      value: `${analysis.vocal}%`,
      score: analysis.vocal,
    },
  ];

  return (
    <Panel variant="violet" className="text-left lg:col-span-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-black tracking-[0.24em] text-cyan-200">
          SYSTEM ANALYSIS
        </h2>
        <span className="border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-xs font-black tracking-[0.18em] text-emerald-100">
          COMPLETE
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {analysisItems.map((item) => (
          <div
            key={item.label}
            className="border border-white/10 bg-white/5 p-3"
          >
            <MeterBar
              label={item.label}
              value={item.score}
              displayValue={item.value}
              variant="pink"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 border border-blue-300/30 bg-blue-500/10 p-4">
        <p className="text-xs font-black tracking-[0.22em] text-cyan-200">
          DYNAMIC EQ
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-xs text-violet-200">THRESHOLD</p>
            <p className="font-black text-white">
              {analysis.mastering.dynamicEq.threshold}
            </p>
          </div>

          <div className="border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-xs text-violet-200">RANGE</p>
            <p className="font-black text-white">
              {analysis.mastering.dynamicEq.range}
            </p>
          </div>

          <div className="border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-xs text-violet-200">ATTACK</p>
            <p className="font-black text-white">
              {analysis.mastering.dynamicEq.attack} ms
            </p>
          </div>

          <div className="border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-xs text-violet-200">RELEASE</p>
            <p className="font-black text-white">
              {analysis.mastering.dynamicEq.release} ms
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 border border-cyan-300/30 bg-cyan-400/10 p-4">
        <p className="text-xs font-black tracking-[0.2em] text-cyan-200">
          ANALYSIS REPORT
        </p>
        <p className="mt-2 font-semibold text-cyan-50">
          {analysis.recommendation}
        </p>
      </div>
    </Panel>
  );
}
