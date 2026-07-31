"use client";

import { RefObject } from "react";
import CyberButton from "./ui/CyberButton";
import Panel from "./ui/Panel";

type InputPanelProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  referenceFileInputRef: RefObject<HTMLInputElement | null>;
  selectedFile: File | null;
  referenceFile: File | null;
  targetSound: string;
  isProcessing: boolean;
  onSelectFile: (file: File | null) => void;
  onSelectReferenceFile: (file: File | null) => void;
  onTargetSoundChange: (value: string) => void;
  onAddTargetSound: (option: string) => void;
  onProcess: () => void;
};

const targetSoundOptions = [
  "🔥 音圧を上げたい",
  "🎤 ボーカルを前に出したい",
  "🗣️ かぶせ・ダブを前に出したい",
  "🎹 オートチューンを強くしたい",
  "🔊 低音を太くしたい",
  "✨ 高音を明るくしたい",
  "🎧 空間を広げたい",
  "🥁 ドラムを目立たせたい",
];

export default function InputPanel({
  fileInputRef,
  referenceFileInputRef,
  selectedFile,
  referenceFile,
  targetSound,
  isProcessing,
  onSelectFile,
  onSelectReferenceFile,
  onTargetSoundChange,
  onAddTargetSound,
  onProcess,
}: InputPanelProps) {
  const clearReferenceFile = () => {
    onSelectReferenceFile(null);

    if (referenceFileInputRef.current) {
      referenceFileInputRef.current.value = "";
    }
  };

  return (
    <Panel variant="violet">
      <div className="border-b border-cyan-300/20 pb-4">
        <p className="text-xs font-black tracking-[0.24em] text-cyan-200">
          INPUT AUDIO
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <CyberButton
            variant="cyan"
            onClick={() => fileInputRef.current?.click()}
            className="px-5 tracking-wide"
          >
            SELECT FILE
          </CyberButton>

          <CyberButton
            variant="pink"
            onClick={onProcess}
            disabled={!selectedFile || isProcessing}
            className="px-5 tracking-wide disabled:translate-y-0 disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
          >
            PROCESS START
          </CyberButton>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav"
          className="hidden"
          onChange={(event) => {
            onSelectFile(event.target.files?.[0] ?? null);
          }}
        />

        <p className="mt-3 break-words border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-cyan-100">
          {selectedFile ? selectedFile.name : "NO FILE SELECTED"}
        </p>
      </div>

      <div className="mt-5 border-b border-cyan-300/20 pb-5">
        <p className="text-xs font-black tracking-[0.24em] text-cyan-200">
          REFERENCE AUDIO
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <CyberButton
            variant="violet"
            onClick={() => referenceFileInputRef.current?.click()}
            className="px-5 tracking-wide"
          >
            SELECT REFERENCE
          </CyberButton>

          {referenceFile && (
            <CyberButton
              variant="ghostPink"
              onClick={clearReferenceFile}
              className="border px-4 text-sm tracking-wide"
            >
              CLEAR
            </CyberButton>
          )}
        </div>

        <input
          ref={referenceFileInputRef}
          type="file"
          accept=".mp3,.wav"
          className="hidden"
          onChange={(event) => {
            onSelectReferenceFile(event.target.files?.[0] ?? null);
          }}
        />

        <p className="mt-3 break-words border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-violet-100">
          {referenceFile ? referenceFile.name : "NO REFERENCE SELECTED"}
        </p>

        <p className="mt-2 text-xs font-bold text-violet-300/80">
          任意：目標にしたい参考曲のWAVまたはMP3を選択
        </p>
      </div>

      <div className="mt-5">
        <h2 className="text-xs font-black tracking-[0.24em] text-cyan-200">
          TARGET SOUND
        </h2>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {targetSoundOptions.map((option) => (
            <CyberButton
              key={option}
              variant="targetSound"
              onClick={() => onAddTargetSound(option)}
              className="border px-3 py-3 text-left text-sm tracking-normal"
            >
              {option}
            </CyberButton>
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
          onChange={(event) => onTargetSoundChange(event.target.value)}
          placeholder={`例）\n・Keijuくらいオートチューンをかけたい\n・ボーカルをもっと前に出したい\n・低音を808っぽくしたい`}
          className="mt-2 w-full border border-violet-300/40 bg-[#05091d] px-4 py-3 text-cyan-50 outline-none shadow-[inset_0_0_18px_rgba(168,85,247,0.1)] placeholder:text-violet-300/50 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/30"
          rows={8}
        />
      </div>
    </Panel>
  );
}
