import CyberButton from "./ui/CyberButton";
import Panel from "./ui/Panel";
import StatusCard from "./ui/StatusCard";
type FinalOutputPanelProps = {
  masteredFileName: string;
  rating: number;
  bass: number;
  treble: number;
  vocal: number;
  loudness: number;
  comment: string;
  savedCount: number;
  onDownload: () => void;
  onRatingChange: (value: number) => void;
  onBassChange: (value: number) => void;
  onTrebleChange: (value: number) => void;
  onVocalChange: (value: number) => void;
  onLoudnessChange: (value: number) => void;
  onCommentChange: (value: string) => void;
  onSaveReview: () => void;
};

export default function FinalOutputPanel({
  masteredFileName,
  rating,
  bass,
  treble,
  vocal,
  loudness,
  comment,
  savedCount,
  onDownload,
  onRatingChange,
  onBassChange,
  onTrebleChange,
  onVocalChange,
  onLoudnessChange,
  onCommentChange,
  onSaveReview,
}: FinalOutputPanelProps) {
  return (
    <div className="space-y-6 lg:col-span-2">
      <Panel variant="pink">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black tracking-[0.24em] text-pink-200">
              FINAL OUTPUT
            </p>

            <h2 className="mt-1 text-2xl font-black tracking-wide text-white [text-shadow:0_0_16px_rgba(236,72,153,0.75)]">
              MASTERING COMPLETE
            </h2>
          </div>

          <span className="border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-xs font-black tracking-[0.18em] text-emerald-100">
            READY
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <StatusCard
            label="OUTPUT FILE"
            value={masteredFileName || "mastered_output.wav"}
          />
          <StatusCard label="FORMAT" value="WAV / MASTERED" />
          <StatusCard label="PROCESS" value="100% COMPLETE" />
          <StatusCard
            label="STATUS"
            value="OUTPUT READY"
            valueClassName="text-emerald-100"
          />
        </div>

        <CyberButton
          variant="cyan"
          fullWidth
          onClick={onDownload}
          className="mt-5"
        >
          DOWNLOAD OUTPUT
        </CyberButton>
      </Panel>

      <Panel variant="cyan" className="text-violet-100">
        <h2 className="mb-4 text-xs font-black tracking-[0.24em] text-cyan-200">
          AI FEEDBACK
        </h2>

        <div className="mb-4">
          <p className="mb-2 font-bold text-violet-200">
            QUALITY SCORE: {rating} / 5
          </p>

          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                onClick={() => onRatingChange(star)}
                className="text-3xl text-pink-300 [text-shadow:0_0_12px_rgba(236,72,153,0.6)] transition hover:-translate-y-0.5 hover:text-cyan-200"
              >
                {star <= rating ? "★" : "☆"}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-2 block font-bold text-cyan-100">
            🔊 LOW END: {bass}
          </label>

          <input
            type="range"
            min="-5"
            max="5"
            value={bass}
            onChange={(event) => onBassChange(Number(event.target.value))}
            className="w-full accent-cyan-300"
          />
        </div>

        <div className="mb-4">
          <label className="mb-2 block font-bold text-cyan-100">
            🎵 HIGH END: {treble}
          </label>

          <input
            type="range"
            min="-5"
            max="5"
            value={treble}
            onChange={(event) => onTrebleChange(Number(event.target.value))}
            className="w-full accent-pink-400"
          />
        </div>

        <div className="mb-4">
          <label className="mb-2 block font-bold text-cyan-100">
            🎤 VOCAL: {vocal}
          </label>

          <input
            type="range"
            min="-5"
            max="5"
            value={vocal}
            onChange={(event) => onVocalChange(Number(event.target.value))}
            className="w-full accent-violet-300"
          />
        </div>

        <div className="mb-4">
          <label className="mb-2 block font-bold text-cyan-100">
            💥 LOUDNESS: {loudness}
          </label>

          <input
            type="range"
            min="-5"
            max="5"
            value={loudness}
            onChange={(event) => onLoudnessChange(Number(event.target.value))}
            className="w-full accent-fuchsia-400"
          />
        </div>

        <div className="mb-4 text-left">
          <label className="mb-2 block font-bold text-cyan-100">
            ENGINEER NOTE
          </label>

          <textarea
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder={`Example:\n- More punch in the kick\n- Vocal slightly louder\n- Reduce harsh high frequencies\n`}
            className="w-full rounded-md border border-violet-300/40 bg-[#080820] p-3 text-cyan-50 outline-none placeholder:text-violet-300/55 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/30"
            rows={4}
          />
        </div>

        <CyberButton
          variant="pink"
          onClick={onSaveReview}
          className="rounded-md"
        >
          SAVE FEEDBACK
        </CyberButton>

        {savedCount > 0 && (
          <p className="mt-3 text-sm font-bold text-violet-200">
            SAVED REPORTS: {savedCount}
          </p>
        )}
      </Panel>
    </div>
  );
}
