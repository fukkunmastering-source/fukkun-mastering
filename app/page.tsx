"use client";
import { useRef, useState } from "react";

type Analysis = {
  loudness: number;
  bass: number;
  treble: number;
  vocal: number;
  recommendation: string;
  eqSuggestion?: string;
};

type Understanding = {
  fileName: string;
  referenceUrl: string;
  targetSound: string;
};

const eqBands = [
  {
    icon: "🔊",
    label: "低音",
    range: "20〜60Hz",
    keywords: ["20〜60Hz", "20-60Hz", "低音", "重低音", "超低音"],
  },
  {
    icon: "🎤",
    label: "声の聞こえやすさ",
    range: "250Hz〜2kHz",
    keywords: ["250Hz〜2kHz", "250Hz-2kHz", "声", "ボーカル", "中音", "中域"],
  },
  {
    icon: "✨",
    label: "高音の抜け感",
    range: "2kHz〜8kHz",
    keywords: ["2kHz〜8kHz", "2kHz-8kHz", "高音", "抜け", "明瞭"],
  },
];

const targetSoundOptions = [
  "🔥 音圧を上げたい",
  "🎤 ボーカルを前に出したい",
  "🎹 オートチューンを強くしたい",
  "🔊 低音を太くしたい",
  "✨ 高音を明るくしたい",
  "🎧 空間を広げたい",
  "🥁 ドラムを目立たせたい",
];

const getEqAdjustment = (eqSuggestion: string, keywords: string[]) => {
  const matchedText =
    eqSuggestion
      .split(/[、,]/)
      .find((part) => keywords.some((keyword) => part.includes(keyword))) ??
    eqSuggestion;

  if (/カット|下げ|抑え|減ら|整理/.test(matchedText)) {
    return { icon: "⬇", text: "少し下げる", colorClass: "text-cyan-200" };
  }

  if (/ブースト|上げ|足す|増や|前に出す/.test(matchedText)) {
    return { icon: "⬆", text: "少し上げる", colorClass: "text-pink-200" };
  }

  return { icon: "↔", text: "少し整える", colorClass: "text-violet-200" };
};

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [targetSound, setTargetSound] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [rating, setRating] = useState(3);
  const [bass, setBass] = useState(0);
  const [treble, setTreble] = useState(0);
  const [vocal, setVocal] = useState(0);
  const [loudness, setLoudness] = useState(0);
  const [comment, setComment] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [masteredFileName, setMasteredFileName] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [understanding, setUnderstanding] = useState<Understanding | null>(null);

  const renderStars = (score: number) => {
    const starCount = Math.round(score / 20);
    return "★".repeat(starCount) + "☆".repeat(5 - starCount);
  };

  const handleAddTargetSound = (option: string) => {
    setTargetSound((currentText) => {
      if (currentText.includes(option)) return currentText;

      return currentText ? `${currentText}\n${option}` : option;
    });
  };

  const handleDownload = () => {
    if (!selectedFile) return;
    const fileName = selectedFile.name;
    const parts = fileName.split(".");
    const text = "ふっくんマスタリングで作成したサンプルファイルです！";
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = masteredFileName || `${parts[0]}_mastered.${parts[1]}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleProcess = async () => {
    if (!selectedFile) return;
    setUnderstanding({
      fileName: selectedFile.name,
      referenceUrl,
      targetSound,
    });
    setProgress(0);
    setIsCompleted(false);
    setAnalysis(null);
    setMasteredFileName("");
    setIsProcessing(true);

    const formData = new FormData();
    formData.append("audio", selectedFile);
    formData.append("referenceUrl", referenceUrl);
    formData.append("targetSound", targetSound);
    try {
      const response = await fetch("/api/mastering", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("APIエラー", response.status, errorText);
        alert("マスタリング処理でエラーが出ました。VS Codeのターミナルログを確認してください。");
        setIsProcessing(false);
        setProgress(0);
        return;
      }

      const data = await response.json();
      console.log("APIからの返事", data);
      console.log("解析結果", data.analysis);
      setMasteredFileName(data.masteredFileName ?? "");
      setAnalysis(data.analysis ?? null);

      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += 5;
        setProgress(currentProgress);
        if (currentProgress >= 100) {
          clearInterval(interval);
          setIsProcessing(false);
          setIsCompleted(true);
        }
      }, 100);
    } catch (error) {
      console.error("処理中にエラー", error);
      alert("処理中にエラーが出ました。VS Codeのターミナルログを確認してください。");
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleSaveReview = () => {
    const review = {
      fileName: selectedFile?.name ?? "不明なファイル",
      rating,
      bass,
      treble,
      vocal,
      loudness,
      comment,
      createdAt: new Date().toISOString(),
    };

    const savedReviewsText = localStorage.getItem("fukkunReviews");
    const savedReviews = savedReviewsText ? JSON.parse(savedReviewsText) : [];
    const newReviews = [...savedReviews, review];

    localStorage.setItem("fukkunReviews", JSON.stringify(newReviews));
    setSavedCount(newReviews.length);

    console.log("保存した評価一覧", newReviews);
    alert("評価を保存しました！");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#040817] px-4 py-6 text-cyan-50 sm:px-6 lg:px-8">
      <div className="fixed inset-0 -z-30 bg-[radial-gradient(circle_at_1px_1px,rgba(125,211,252,0.18)_1px,transparent_0)] bg-[length:16px_16px]" />
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_18%_8%,rgba(37,99,235,0.3),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(168,85,247,0.24),transparent_24%),radial-gradient(circle_at_52%_90%,rgba(236,72,153,0.18),transparent_30%)]" />
      <div className="fixed inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-cyan-400/10 to-transparent" />
      <div
        className={`pointer-events-none fixed bottom-5 right-4 z-10 hidden origin-bottom-right items-end gap-1 border border-cyan-300/40 bg-[#05091d]/80 p-2 backdrop-blur transition-all duration-500 xl:flex ${
          isProcessing
            ? "scale-90 shadow-[0_0_34px_rgba(34,211,238,0.42)]"
            : isCompleted
              ? "scale-75 shadow-[0_0_24px_rgba(34,211,238,0.28)] opacity-90"
              : "scale-70 shadow-[0_0_18px_rgba(34,211,238,0.18)] opacity-60"
        }`}
      >
        {[38, 68, 44, 88, 58, 104, 48, 76, 96].map((height, index) => (
          <div
            key={height + index}
            className={`w-2 border border-white/10 bg-gradient-to-t from-blue-500 via-fuchsia-400 to-cyan-200 ${
              isProcessing
                ? "animate-bounce shadow-[0_0_18px_rgba(34,211,238,0.85)]"
                : "animate-pulse shadow-[0_0_12px_rgba(34,211,238,0.55)]"
            }`}
            style={{
              height: `${height}px`,
              animationDelay: `${index * (isProcessing ? 70 : 160)}ms`,
              animationDuration: isProcessing ? "650ms" : "1800ms",
            }}
          />
        ))}
      </div>

      <div className="mx-auto w-full max-w-7xl">
        <header className="border border-cyan-300/40 bg-[#071025]/80 p-5 shadow-[0_0_36px_rgba(34,211,238,0.22)] backdrop-blur">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black tracking-[0.32em] text-pink-200">
                SYSTEM VERSION 0.1
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-wide text-white [text-shadow:0_0_18px_rgba(34,211,238,0.75)] sm:text-6xl">
                FUKKUN MASTERING
              </h1>
              <p className="mt-2 font-semibold text-violet-200">
                Near Future AI Mastering Console
              </p>
            </div>
            <div className="flex items-center gap-3 border border-red-300/50 bg-red-500/10 px-4 py-3 shadow-[0_0_22px_rgba(239,68,68,0.32)]">
              <span className="h-3 w-3 animate-pulse rounded-full bg-red-500 shadow-[0_0_16px_rgba(248,113,113,0.95)]" />
              <span className="text-sm font-black tracking-[0.22em] text-red-100">
                ONLINE
              </span>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <section className="border border-violet-300/40 bg-[#071025]/75 p-5 shadow-[0_0_30px_rgba(168,85,247,0.18)] backdrop-blur">
            <div className="border-b border-cyan-300/20 pb-4">
              <p className="text-xs font-black tracking-[0.24em] text-cyan-200">
                INPUT AUDIO
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-cyan-200 bg-blue-600 px-5 py-3 font-black tracking-wide text-white shadow-[4px_4px_0_rgba(236,72,153,0.85),0_0_22px_rgba(37,99,235,0.5)] transition hover:-translate-y-0.5 hover:bg-cyan-500"
                >
                  SELECT FILE
                </button>
                <button
                  onClick={handleProcess}
                  disabled={!selectedFile || isProcessing}
                  className="border-2 border-pink-200 bg-pink-600 px-5 py-3 font-black tracking-wide text-white shadow-[4px_4px_0_rgba(34,211,238,0.85),0_0_22px_rgba(236,72,153,0.5)] transition hover:-translate-y-0.5 hover:bg-fuchsia-500 disabled:translate-y-0 disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
                >
                  PROCESS START
                </button>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".mp3,.wav"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
              />
              <p className="mt-3 break-words border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-cyan-100">
                {selectedFile ? selectedFile.name : "NO FILE SELECTED"}
              </p>
            </div>

            <div className="mt-5">
              <label
                htmlFor="referenceUrl"
                className="block text-xs font-black tracking-[0.24em] text-cyan-200"
              >
                REFERENCE
              </label>
              <input
                id="referenceUrl"
                type="url"
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
                placeholder="参考曲URL"
                className="mt-2 w-full border border-cyan-300/40 bg-[#05091d] px-4 py-3 text-cyan-50 outline-none shadow-[inset_0_0_18px_rgba(34,211,238,0.08)] placeholder:text-violet-300/50 focus:border-pink-300 focus:ring-2 focus:ring-pink-400/30"
              />
            </div>

            <div className="mt-5">
              <h2 className="text-xs font-black tracking-[0.24em] text-cyan-200">
                TARGET SOUND
              </h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {targetSoundOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleAddTargetSound(option)}
                    className="border border-blue-300/40 bg-blue-500/10 px-3 py-3 text-left text-sm font-black text-cyan-100 shadow-[0_0_16px_rgba(59,130,246,0.14)] transition hover:-translate-y-0.5 hover:border-pink-300 hover:bg-pink-500/15 hover:text-pink-100"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <label
                htmlFor="targetSound"
                className="block text-xs font-black tracking-[0.24em] text-cyan-200"
              >
                FREE NOTE
              </label>
              <textarea
                id="targetSound"
                value={targetSound}
                onChange={(e) => setTargetSound(e.target.value)}
                placeholder={`例）\n・Keijuくらいオートチューンをかけたい\n・ボーカルをもっと前に出したい\n・低音を808っぽくしたい`}
                className="mt-2 w-full border border-violet-300/40 bg-[#05091d] px-4 py-3 text-cyan-50 outline-none shadow-[inset_0_0_18px_rgba(168,85,247,0.1)] placeholder:text-violet-300/50 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/30"
                rows={8}
              />
            </div>
          </section>

          <section className="space-y-6">
            <div className="border border-cyan-300/40 bg-[#071025]/75 p-5 shadow-[0_0_30px_rgba(34,211,238,0.18)] backdrop-blur">
              <h2 className="text-xs font-black tracking-[0.24em] text-cyan-200">
                SYSTEM STATUS
              </h2>
             {!isProcessing ? (
                <div className="mt-4 grid gap-2 text-sm font-black">
                  <div className="flex items-center justify-between border border-white/10 bg-white/5 px-3 py-2">
                    <span>INPUT AUDIO</span>
                    <span className={selectedFile ? "text-emerald-200" : "text-slate-500"}>
                      {selectedFile ? "LOADED" : "WAITING"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border border-white/10 bg-white/5 px-3 py-2">
                    <span>REFERENCE AUDIO</span>
                    <span className={referenceUrl.trim() ? "text-emerald-200" : "text-violet-300"}>
                      {referenceUrl.trim() ? "LOADED" : "OPTIONAL"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border border-white/10 bg-white/5 px-3 py-2">
                    <span>TARGET PROFILE</span>
                    <span className={targetSound.trim() ? "text-emerald-200" : "text-violet-300"}>
                      {targetSound.trim() ? "LOADED" : "OPTIONAL"}
                    </span>
                  </div>
                  <div className="border border-pink-300/30 bg-pink-500/10 px-3 py-2 text-pink-100">
                    SYSTEM STANDBY / READY TO START
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-2 text-sm font-black">
                  {understanding && (
                    <div className="mb-4 space-y-2 border border-cyan-300/20 bg-cyan-400/5 p-3 text-xs text-violet-100">
                      <p className="break-words">INPUT AUDIO: {understanding.fileName}</p>
                      <p className="break-words">
                        REFERENCE AUDIO: {understanding.referenceUrl.trim() || "NOT SET"}
                      </p>
                      <p>
                        TARGET PROFILE:{" "}
                        {understanding.targetSound.trim() ? "LOADED" : "NOT SET"}
                      </p>
                    </div>
                  )}
                  {[
                    "LOADING INPUT AUDIO",
                    "ANALYZING REFERENCE TRACK",
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
            </div>

            {isCompleted && analysis && (
              <div className="border border-violet-300/50 bg-[#071025]/75 p-5 text-left shadow-[0_0_32px_rgba(168,85,247,0.22)] backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xs font-black tracking-[0.24em] text-cyan-200">
                    SYSTEM ANALYSIS
                  </h2>
                  <span className="border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-xs font-black tracking-[0.18em] text-emerald-100">
                    COMPLETE
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "LOUDNESS", value: `${analysis.loudness} dB`, score: Math.min(100, Math.max(0, Math.round((analysis.loudness + 24) * 5))) },
                    { label: "BASS", value: `${analysis.bass} / 100`, score: analysis.bass },
                    { label: "TREBLE", value: `${analysis.treble} / 100`, score: analysis.treble },
                    { label: "VOCAL", value: `${analysis.vocal} / 100`, score: analysis.vocal },
                  ].map((item) => (
                    <div key={item.label} className="border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black tracking-[0.12em] text-pink-200">
                          {item.label}
                        </p>
                        <p className="font-black text-white">{item.value}</p>
                      </div>
                      <div className="mt-3 h-3 w-full overflow-hidden border border-cyan-300/30 bg-slate-950 shadow-[inset_0_0_10px_rgba(0,0,0,0.75)]">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-pink-400 shadow-[0_0_14px_rgba(236,72,153,0.65)]"
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border border-cyan-300/30 bg-cyan-400/10 p-4">
                  <p className="text-xs font-black tracking-[0.2em] text-cyan-200">
                    ANALYSIS REPORT
                  </p>
                  <p className="mt-2 font-semibold text-cyan-50">
                    {analysis.recommendation}
                  </p>
                </div>
              </div>
            )}

            {isCompleted && analysis?.eqSuggestion && (
              <div className="border border-blue-300/40 bg-[#071025]/75 p-5 shadow-[0_0_28px_rgba(59,130,246,0.18)] backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xs font-black tracking-[0.24em] text-cyan-200">
                    OPTIMIZATION
                  </h2>
                  <span className="border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-xs font-black tracking-[0.18em] text-cyan-100">
                    PROFILE GENERATED
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {[
                    { label: "LOW END", value: "+3", score: 68 },
                    { label: "VOCAL RANGE", value: "+4", score: 81 },
                    { label: "HIGH END", value: "+2", score: 74 },
                    { label: "STEREO IMAGE", value: "+2", score: 64 },
                    { label: "OUTPUT LIMITER", value: "ACTIVE", score: 92 },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="border border-white/10 bg-white/5 px-4 py-3 shadow-[0_0_14px_rgba(255,255,255,0.06)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black tracking-[0.14em] text-violet-100">
                          {item.label}
                        </p>
                        <p className="text-sm font-black tracking-[0.12em] text-pink-200">
                          {item.value}
                        </p>
                      </div>
                      <div className="mt-3 h-3 w-full overflow-hidden border border-cyan-300/30 bg-slate-950 shadow-[inset_0_0_10px_rgba(0,0,0,0.75)]">
                        <div
                          className="h-full bg-gradient-to-r from-blue-400 via-cyan-300 to-fuchsia-400 shadow-[0_0_14px_rgba(34,211,238,0.65)]"
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border border-pink-300/30 bg-pink-500/10 px-4 py-3">
                  <p className="text-xs font-black tracking-[0.2em] text-pink-200">
                    MASTERING PROFILE
                  </p>
                  <p className="mt-1 font-black text-white">
                    {analysis.eqSuggestion}
                  </p>
                </div>
              </div>
            )}

            {isCompleted && (
              <div className="space-y-6">
                <div className="border border-pink-300/50 bg-[#071025]/75 p-5 shadow-[0_0_30px_rgba(236,72,153,0.22)] backdrop-blur">
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
                    <div className="border border-white/10 bg-white/5 p-3">
                      <p className="text-xs font-black tracking-[0.16em] text-cyan-200">
                        OUTPUT FILE
                      </p>
                      <p className="mt-2 break-words font-black text-white">
                        {masteredFileName || "mastered_output.wav"}
                      </p>
                    </div>
                    <div className="border border-white/10 bg-white/5 p-3">
                      <p className="text-xs font-black tracking-[0.16em] text-cyan-200">
                        FORMAT
                      </p>
                      <p className="mt-2 font-black text-white">
                        WAV / MASTERED
                      </p>
                    </div>
                    <div className="border border-white/10 bg-white/5 p-3">
                      <p className="text-xs font-black tracking-[0.16em] text-cyan-200">
                        PROCESS
                      </p>
                      <p className="mt-2 font-black text-white">
                        100% COMPLETE
                      </p>
                    </div>
                    <div className="border border-white/10 bg-white/5 p-3">
                      <p className="text-xs font-black tracking-[0.16em] text-cyan-200">
                        STATUS
                      </p>
                      <p className="mt-2 font-black text-emerald-100">
                        OUTPUT READY
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleDownload}
                    className="mt-5 w-full border-2 border-cyan-200 bg-blue-600 px-6 py-3 font-black tracking-[0.18em] text-white shadow-[4px_4px_0_rgba(236,72,153,0.85),0_0_22px_rgba(37,99,235,0.5)] transition hover:-translate-y-0.5 hover:bg-cyan-500"
                  >
                    DOWNLOAD OUTPUT
                  </button>
                </div>

                <div className="border border-cyan-300/40 bg-[#071025]/75 p-5 text-violet-100 shadow-[0_0_28px_rgba(34,211,238,0.18)] backdrop-blur">
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
                          key={star}
                          onClick={() => setRating(star)}
                          className="text-3xl text-pink-300 [text-shadow:0_0_12px_rgba(236,72,153,0.6)] transition hover:-translate-y-0.5 hover:text-cyan-200"
                        >
                          {star <= rating ? "★" : "☆"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block mb-2 font-bold text-cyan-100">
                      🔊 LOW END: {bass}
                    </label>
                    <input
                      type="range"
                      min="-5"
                      max="5"
                      value={bass}
                      onChange={(e) => setBass(Number(e.target.value))}
                      className="w-full accent-cyan-300"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block mb-2 font-bold text-cyan-100">
                      🎵 HIGH END: {treble}
                    </label>
                    <input
                      type="range"
                      min="-5"
                      max="5"
                      value={treble}
                      onChange={(e) => setTreble(Number(e.target.value))}
                      className="w-full accent-pink-400"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block mb-2 font-bold text-cyan-100">
                      🎤 VOCAL: {vocal}
                    </label>
                    <input
                      type="range"
                      min="-5"
                      max="5"
                      value={vocal}
                      onChange={(e) => setVocal(Number(e.target.value))}
                      className="w-full accent-violet-300"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block mb-2 font-bold text-cyan-100">
                      💥 LOUDNESS: {loudness}
                    </label>
                    <input
                      type="range"
                      min="-5"
                      max="5"
                      value={loudness}
                      onChange={(e) => setLoudness(Number(e.target.value))}
                      className="w-full accent-fuchsia-400"
                    />
                  </div>

                  <div className="mb-4 text-left">
                    <label className="block mb-2 font-bold text-cyan-100">
                      ENGINEER NOTE
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={`Example:\n- More punch in the kick\n- Vocal slightly louder\n- Reduce harsh high frequencies\n`}
                      className="w-full border border-violet-300/40 bg-[#080820] p-3 text-cyan-50 outline-none placeholder:text-violet-300/55 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/30 rounded-md"
                      rows={4}
                    />
                  </div>

                  <button
                    onClick={handleSaveReview}
                    className="border-2 border-pink-200 bg-pink-600 px-6 py-3 font-black text-white shadow-[4px_4px_0_rgba(34,211,238,0.85),0_0_22px_rgba(236,72,153,0.55)] transition hover:-translate-y-0.5 hover:bg-fuchsia-500 rounded-md"
                  >
                    SAVE FEEDBACK
                  </button>

                  {savedCount > 0 && (
                    <p className="mt-3 text-sm font-bold text-violet-200">
                      SAVED REPORTS: {savedCount}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
