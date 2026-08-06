"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import InputPanel from "./components/InputPanel";
import SystemStatusPanel from "./components/SystemStatusPanel";
import SystemAnalysisPanel from "./components/SystemAnalysisPanel";
import OptimizationPanel from "./components/OptimizationPanel";
import FinalOutputPanel from "./components/FinalOutputPanel";

type Analysis = {
  loudness: number;
  bass: number;
  treble: number;
  vocal: number;
  recommendation: string;
  eqSuggestion?: string;
  measuredLoudness?: {
    integratedLufs: number | null;
  } | null;
  inputMeasuredLoudness?: {
    integratedLufs: number | null;
  } | null;
  mastering: {
    bassGain: number;
    vocalGain: number;
    trebleGain: number;
    dynamicEq: {
      threshold: number;
      range: number;
      attack: number;
      release: number;
    };
    limiter: boolean;
    targetLufs: number;
  };
};

type Understanding = {
  fileName: string;
  referenceFileName: string;
  targetSound: string;
};

const getOptimizationValue = (score: number) => {
  if (score >= 85) {
    return { value: "+4", action: "BOOST" };
  }
  if (score >= 70) {
    return { value: "+2", action: "BOOST" };
  }
  if (score >= 45) {
    return { value: "±0", action: "KEEP" };
  }
  if (score >= 25) {
    return { value: "-2", action: "CUT" };
  }
  return { value: "-4", action: "CUT" };
};

const getLoudnessAdjustment = (loudness: number) => {
  if (loudness <= -16) return "+4 dB";
  if (loudness <= -13) return "+2 dB";
  if (loudness <= -9) return "±0 dB";
  return "-2 dB";
};

type PixelCode = "0" | "1" | "2" | "3" | "4" | "5";
const pixelClassMap: Record<PixelCode, string> = {
  "0": "bg-transparent",
  "1": "bg-cyan-100 shadow-[0_0_6px_rgba(207,250,254,0.75)]",
  "2": "bg-pink-300 shadow-[0_0_8px_rgba(244,114,182,0.95)]",
  "3": "bg-white shadow-[0_0_10px_rgba(255,255,255,0.95)]",
  "4": "bg-violet-400 shadow-[0_0_7px_rgba(167,139,250,0.85)]",
  "5": "bg-cyan-500 shadow-[0_0_7px_rgba(6,182,212,0.85)]",
};
const recordPixels = [
  "0000004444000000",
  "0000441111440000",
  "0004111111114000",
  "0041112222111400",
  "0411122222211140",
  "0411221111221140",
  "4112213333122114",
  "4112133333312114",
  "4112133553312114",
  "4112213333122114",
  "0411221111221140",
  "0411122222211140",
  "0041112222111400",
  "0004111111114000",
  "0000441111440000",
  "0000004444000000",
];
const PixelRecord = () => {
  return (
    <div className="flex h-full min-h-[244px] items-center justify-center border border-cyan-300/20 bg-[#05091d]/70 p-6 shadow-[inset_0_0_24px_rgba(34,211,238,0.06),0_0_18px_rgba(34,211,238,0.08)]">
      <div className="relative">
        <div className="absolute inset-0 scale-110 rounded-full bg-cyan-300/10 blur-xl" />
        <div className="relative grid grid-cols-16 gap-px [image-rendering:pixelated] animate-[spin_14s_linear_infinite]">
          {recordPixels.flatMap((row, rowIndex) =>
            row.split("").map((pixel, columnIndex) => (
              <span
                key={`${rowIndex}-${columnIndex}`}
                className={`h-2 w-2 ${
                  pixelClassMap[pixel as PixelCode]
                }`}
              />
            )),
          )}
        </div>
        <div className="absolute -right-5 top-2 h-24 w-1 rotate-12 bg-violet-300 shadow-[0_0_10px_rgba(196,181,253,0.75)]" />
        <div className="absolute -right-7 top-0 h-3 w-3 border border-pink-200 bg-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.85)]" />
      </div>
    </div>
  );
};
export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceFileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
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
  const [masteredFileUrl, setMasteredFileUrl] = useState("");
  const [activeAudio, setActiveAudio] = useState<"original" | "mastered">(
    "mastered",
  );
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
    const [understanding, setUnderstanding] = useState<Understanding | null>(
    null,
  );

  const originalFileUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : ""),
    [selectedFile],
  );

  const comparisonLevels = useMemo(() => {
    const inputLufs = analysis?.inputMeasuredLoudness?.integratedLufs;
    const masteredLufs = analysis?.measuredLoudness?.integratedLufs;

    if (
      typeof inputLufs !== "number" ||
      !Number.isFinite(inputLufs) ||
      typeof masteredLufs !== "number" ||
      !Number.isFinite(masteredLufs)
    ) {
      return {
        isMatched: false,
        originalVolume: 1,
        masteredVolume: 1,
      };
    }

    const comparisonLufs = Math.min(inputLufs, masteredLufs);
    const toVolume = (sourceLufs: number) =>
      Math.min(1, Math.max(0, 10 ** ((comparisonLufs - sourceLufs) / 20)));

    return {
      isMatched: true,
      originalVolume: toVolume(inputLufs),
      masteredVolume: toVolume(masteredLufs),
    };
  }, [analysis]);

  useEffect(
    () => () => {
      if (originalFileUrl) {
        URL.revokeObjectURL(originalFileUrl);
      }
    },
    [originalFileUrl],
  );

  useEffect(() => {
    if (!audioRef.current) return;

    audioRef.current.volume =
      activeAudio === "original"
        ? comparisonLevels.originalVolume
        : comparisonLevels.masteredVolume;
  }, [activeAudio, comparisonLevels]);

  const handleAddTargetSound = (option: string) => {
    setTargetSound((currentText) => {
      if (currentText.includes(option)) return currentText;

      return currentText ? `${currentText}\n${option}` : option;
    });
  };

  const handleDownload = () => {
    if (!masteredFileUrl) return;

    const a = document.createElement("a");
    a.href = masteredFileUrl;
    a.download = masteredFileName || "mastered_output.wav";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const switchAudio = (source: "original" | "mastered") => {
    const nextUrl = source === "original" ? originalFileUrl : masteredFileUrl;
    if (!nextUrl) return;

    const audio = audioRef.current;
    const currentTime = audio?.currentTime ?? 0;
    const wasPlaying = audio ? !audio.paused : false;

    setActiveAudio(source);

    window.requestAnimationFrame(() => {
      if (!audioRef.current) return;

      audioRef.current.currentTime = currentTime;

      if (wasPlaying) {
        void audioRef.current.play();
      }
    });
  };

  const handleProcess = async () => {
    if (!selectedFile) return;

  setUnderstanding({
    fileName: selectedFile.name,
    referenceFileName: referenceFile?.name ?? "",
    targetSound,
   });
    setProgress(0);
    setIsCompleted(false);
    setAnalysis(null);
    setMasteredFileName("");
    setMasteredFileUrl("");
    setActiveAudio("mastered");
    setIsProcessing(true);

   const formData = new FormData();
   formData.append("audio", selectedFile);

   if (referenceFile) {
   formData.append("referenceAudio", referenceFile);
   }

   formData.append("targetSound", targetSound);
    try {
      const response = await fetch("/api/mastering", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("APIエラー", response.status, errorData);
        alert(
          errorData?.message ??
            "マスタリング処理に失敗しました。時間を置いてもう一度お試しください。",
        );
        setIsProcessing(false);
        setProgress(0);
        return;
      }

      const data = await response.json();
      console.log("APIからの返事", data);
      console.log("解析結果", data.analysis);
      setMasteredFileName(data.masteredFileName ?? "");
      setMasteredFileUrl(data.masteredFileUrl ?? "");
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
      alert(
        "サーバーへ接続できませんでした。時間を置いてもう一度お試しください。",
      );
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
          <InputPanel
            fileInputRef={fileInputRef}
            referenceFileInputRef={referenceFileInputRef}
            selectedFile={selectedFile}
            referenceFile={referenceFile}
            targetSound={targetSound}
            isProcessing={isProcessing}
            onSelectFile={setSelectedFile}
            onSelectReferenceFile={setReferenceFile}
            onTargetSoundChange={setTargetSound}
            onAddTargetSound={handleAddTargetSound}
            onProcess={handleProcess}
          />

         <SystemStatusPanel
           isCompleted={isCompleted}
           isProcessing={isProcessing}
           progress={progress}
           selectedFile={selectedFile}
           referenceFile={referenceFile}
           targetSound={targetSound}
           understanding={understanding}
           activeAudio={activeAudio}
           originalFileUrl={originalFileUrl}
           masteredFileUrl={masteredFileUrl}
           isLoudnessMatched={comparisonLevels.isMatched}
           audioRef={audioRef}
           onSwitchAudio={switchAudio}
           onDownload={handleDownload}
        />
        {isCompleted && analysis && (
         <SystemAnalysisPanel analysis={analysis} />
         )}

           {isCompleted && analysis?.eqSuggestion && (
            <OptimizationPanel
              analysis={analysis}
              getOptimizationValue={getOptimizationValue}
              getLoudnessAdjustment={getLoudnessAdjustment}
              PixelRecord={PixelRecord}
           />
         )}
{isCompleted && (
  <FinalOutputPanel
    masteredFileName={masteredFileName}
    rating={rating}
    bass={bass}
    treble={treble}
    vocal={vocal}
    loudness={loudness}
    comment={comment}
    savedCount={savedCount}
    onDownload={handleDownload}
    onRatingChange={setRating}
    onBassChange={setBass}
    onTrebleChange={setTreble}
    onVocalChange={setVocal}
    onLoudnessChange={setLoudness}
    onCommentChange={setComment}
    onSaveReview={handleSaveReview}
  />
)}  
                    </div>
      </div>
    </main>
  );
}
