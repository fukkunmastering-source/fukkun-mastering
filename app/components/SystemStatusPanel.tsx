import type { RefObject } from "react";
import Panel from "./ui/Panel";

type Understanding = {
  fileName: string;
  referenceFileName: string;
  targetSound: string;
};

type AiUnitStatus = "standby" | "analyzing" | "complete";
type PixelCode = "0" | "1" | "2" | "3" | "4" | "5";

type SystemStatusPanelProps = {
  isCompleted: boolean;
  isProcessing: boolean;
  progress: number;
  selectedFile: File | null;
  referenceFile: File | null;
  targetSound: string;
  understanding: Understanding | null;
  activeAudio: "original" | "mastered";
  originalFileUrl: string;
  masteredFileUrl: string;
  audioRef: RefObject<HTMLAudioElement | null>;
  onSwitchAudio: (source: "original" | "mastered") => void;
  onDownload: () => void;
};

const aiUnitFrames: Record<AiUnitStatus, string[]> = {
  standby: [
    "0000004400000000",
    "0000041140000000",
    "0000411114000000",
    "0004111111400000",
    "0041111111140000",
    "0411331133114000",
    "4111331133111400",
    "4111111111111400",
    "4111222222111400",
    "0411111111114000",
    "0041111111140000",
    "0004115511400000",
    "0000455554000000",
    "0004555555400000",
    "0045550055540000",
    "0004400004400000",
  ],
  analyzing: [
    "0000004400000000",
    "0000041140000000",
    "0000411114000000",
    "0004111111400000",
    "0041111111140000",
    "0411333333114000",
    "4111333333111400",
    "4111111111111400",
    "4111222222111400",
    "0411111111114000",
    "0041111111140000",
    "0004115511400000",
    "0000455554000000",
    "0004555555400000",
    "0045550055540000",
    "0004400004400000",
  ],
  complete: [
    "0000004400000000",
    "0000041140000000",
    "0000411114000000",
    "0004111111400000",
    "0041111111140000",
    "0411331133114000",
    "4111331133111400",
    "4111111111111400",
    "4111002220011400",
    "0411111111114000",
    "0041111111140000",
    "0004115511400000",
    "0000455554000000",
    "0004555555400000",
    "0045550055540000",
    "0004400004400000",
  ],
};

const pixelClassMap: Record<PixelCode, string> = {
  "0": "bg-transparent",
  "1": "bg-cyan-100 shadow-[0_0_6px_rgba(207,250,254,0.75)]",
  "2": "bg-pink-300 shadow-[0_0_8px_rgba(244,114,182,0.95)]",
  "3": "bg-white shadow-[0_0_10px_rgba(255,255,255,0.95)]",
  "4": "bg-violet-400 shadow-[0_0_7px_rgba(167,139,250,0.85)]",
  "5": "bg-cyan-500 shadow-[0_0_7px_rgba(6,182,212,0.85)]",
};

const AiUnitPixel = ({ status }: { status: AiUnitStatus }) => {
  const frame = aiUnitFrames[status];

  return (
    <div className="inline-flex flex-col items-center gap-2 border border-cyan-300/30 bg-[#020617]/90 p-3 shadow-[0_0_18px_rgba(34,211,238,0.18)]">
      <div className="grid grid-cols-16 gap-px [image-rendering:pixelated]">
        {frame.flatMap((row, rowIndex) =>
          row.split("").map((pixel, columnIndex) => (
            <span
              key={`${rowIndex}-${columnIndex}`}
              className={`h-1.5 w-1.5 ${
                pixelClassMap[pixel as PixelCode]
              }`}
            />
          )),
        )}
      </div>

      <div className="flex gap-1">
        {[0, 1, 2].map((light) => (
          <span
            key={light}
            className={`h-1.5 w-1.5 ${
              status === "analyzing"
                ? "animate-pulse bg-pink-300"
                : status === "complete"
                  ? "bg-emerald-300"
                  : light === 0
                    ? "bg-cyan-300"
                    : "bg-slate-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default function SystemStatusPanel({
  isCompleted,
  isProcessing,
  progress,
  selectedFile,
  referenceFile,
  targetSound,
  understanding,
  activeAudio,
  originalFileUrl,
  masteredFileUrl,
  audioRef,
  onSwitchAudio,
  onDownload,
}: SystemStatusPanelProps) {
  return (
    <Panel variant="cyan">
      <h2 className="text-xs font-black tracking-[0.24em] text-cyan-200">
        SYSTEM STATUS
      </h2>

      <div className="mt-4 border border-cyan-300/30 bg-cyan-400/5 p-4">
        {!isCompleted ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-cyan-200">
                  AI UNIT-01
                </p>

                <div className="mt-2">
                  <AiUnitPixel
                    status={
                      isProcessing
                        ? "analyzing"
                        : "standby"
                    }
                  />
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs font-black tracking-[0.16em] text-violet-200">
                  STATUS
                </p>

                <p className="mt-1 font-black text-white">
                  {isProcessing ? "ANALYZING..." : "STANDBY"}
                </p>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded bg-slate-900">
              <div
                className="h-full bg-gradient-to-r from-cyan-300 to-pink-400 transition-all duration-500"
                style={{
                  width: `${isProcessing ? progress : 10}%`,
                }}
              />
            </div>

            <p className="mt-3 text-xs tracking-[0.12em] text-cyan-100">
              {isProcessing
                ? "SCANNING AUDIO DATA..."
                : "WAITING FOR INPUT"}
            </p>
          </>
        ) : (
          <div className="py-6 text-center">
            <h2 className="text-4xl font-black text-white [text-shadow:0_0_18px_rgba(236,72,153,0.9)]">
              MASTERING COMPLETE
            </h2>

            <p className="mt-4 text-lg font-black text-emerald-300">
              ✓ OUTPUT READY
            </p>

            <div className="mt-5 border border-cyan-300/30 bg-cyan-400/5 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black tracking-[0.22em] text-cyan-200">
                    A/B COMPARISON
                  </p>

                  <p className="mt-1 text-xs font-bold text-violet-200">
                    元音源とマスタリング後を同じ位置で切り替え
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSwitchAudio("original")}
                    disabled={!originalFileUrl}
                    className={`border px-3 py-1.5 text-[11px] font-black tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      activeAudio === "original"
                        ? "border-cyan-200 bg-cyan-500 text-slate-950 shadow-[0_0_16px_rgba(34,211,238,0.45)]"
                        : "border-cyan-300/40 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20"
                    }`}
                  >
                    ORIGINAL
                  </button>

                  <button
                    type="button"
                    onClick={() => onSwitchAudio("mastered")}
                    disabled={!masteredFileUrl}
                    className={`border px-3 py-1.5 text-[11px] font-black tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
                      activeAudio === "mastered"
                        ? "border-pink-200 bg-pink-500 text-white shadow-[0_0_16px_rgba(236,72,153,0.45)]"
                        : "border-pink-300/40 bg-pink-400/10 text-pink-100 hover:bg-pink-400/20"
                    }`}
                  >
                    MASTERED
                  </button>
                </div>
              </div>

              <div className="mt-3 border border-white/10 bg-black/25 p-2.5">
                <p className="mb-1.5 text-[11px] font-black tracking-[0.16em] text-violet-200">
                  PLAYING:{" "}
                  {activeAudio === "original" ? "ORIGINAL" : "MASTERED"}
                </p>

                <audio
                  ref={audioRef}
                  key={activeAudio}
                  controls
                  preload="metadata"
                  src={
                    activeAudio === "original"
                      ? originalFileUrl
                      : masteredFileUrl
                  }
                  className="w-full"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={onDownload}
              disabled={!masteredFileUrl}
              className="mt-5 w-full border-2 border-cyan-200 bg-blue-600 px-6 py-3 font-black tracking-[0.18em] text-white shadow-[4px_4px_0_rgba(236,72,153,0.85),0_0_22px_rgba(37,99,235,0.5)] transition hover:-translate-y-0.5 hover:bg-cyan-500 disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
            >
              DOWNLOAD OUTPUT
            </button>

            <div className="mt-5 flex items-center justify-center gap-3 text-xs font-black tracking-[0.24em] text-violet-200">
              <span className="animate-bounce text-cyan-200">▼</span>
              <span>SCROLL TO VIEW MASTERING REPORT</span>
              <span className="animate-bounce text-cyan-200">▼</span>
            </div>
          </div>
        )}
      </div>

      {!isProcessing ? (
        <div className="mt-4 grid gap-2 text-sm font-black">
          <div className="flex items-center justify-between border border-white/10 bg-white/5 px-3 py-2">
            <span>INPUT AUDIO</span>
            <span
              className={
                selectedFile
                  ? "text-emerald-200"
                  : "text-slate-500"
              }
            >
              {selectedFile ? "LOADED" : "WAITING"}
            </span>
          </div>

          <div className="flex items-center justify-between border border-white/10 bg-white/5 px-3 py-2">
            <span>REFERENCE AUDIO</span>
            <span
              className={
                referenceFile
                  ? "text-emerald-200"
                  : "text-violet-300"
              }
            >
              {referenceFile ? "LOADED" : "OPTIONAL"}
            </span>
          </div>

          <div className="flex items-center justify-between border border-white/10 bg-white/5 px-3 py-2">
            <span>TARGET PROFILE</span>
            <span
              className={
                targetSound.trim()
                  ? "text-emerald-200"
                  : "text-violet-300"
              }
            >
              {targetSound.trim() ? "LOADED" : "OPTIONAL"}
            </span>
          </div>

          <div
            className={`border px-3 py-2 font-black transition-all ${
              isCompleted
                ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                : "border-pink-300/30 bg-pink-500/10 text-pink-100"
            }`}
          >
            {isCompleted
              ? "SYSTEM COMPLETE / OUTPUT READY"
              : "SYSTEM STANDBY / READY TO START"}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2 text-sm font-black">
          {understanding && (
            <div className="mb-4 space-y-2 border border-cyan-300/20 bg-cyan-400/5 p-3 text-xs text-violet-100">
              <p className="break-words">
                INPUT AUDIO: {understanding.fileName}
              </p>

              <p className="break-words">
                REFERENCE AUDIO:{" "}
                {understanding.referenceFileName || "NOT SET"}
              </p>

              <p>
                TARGET PROFILE:{" "}
                {understanding.targetSound.trim()
                  ? "LOADED"
                  : "NOT SET"}
              </p>
            </div>
          )}

          {[
            "LOADING INPUT AUDIO",
            referenceFile
              ? "REFERENCE ANALYSIS NOT YET APPLIED"
              : "REFERENCE TRACK NOT SET",
            "MEASURING LOUDNESS BALANCE",
            "SCANNING TONE PROFILE",
            "GENERATING MASTERING PROFILE",
          ].map((step, index) => (
            <div
              key={step}
              className="border border-white/10 bg-white/5 px-3 py-2 text-cyan-100"
            >
              <span className="mr-2 text-pink-300">
                {progress >= index * 20 ? "●" : "○"}
              </span>
              {step}
            </div>
          ))}

          <div className="mt-4 h-4 w-full overflow-hidden border border-cyan-300/40 bg-slate-950 shadow-[inset_0_0_12px_rgba(0,0,0,0.8)]">
            <div
              className="h-full bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-pink-400 shadow-[0_0_18px_rgba(236,72,153,0.65)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-xs font-black tracking-[0.2em] text-violet-200">
            SYSTEM PROCESS {progress}%
          </p>
        </div>
      )}
    </Panel>
  );
}
