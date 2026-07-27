import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Download, FileAudio, Loader2, Play, Square, Upload } from "lucide-react";
import { ApiError, dub, transcribe } from "@/lib/api";
import { AudioPlayer, wavToPcm16 } from "@/lib/audio";
import { isRtlText, textDirection } from "@/lib/textStats";
import { focusRing } from "@/lib/theme";
import { DESIGN_CHIPS, appendDesignChip, effectiveMode, type VoiceMode } from "@/lib/voiceModes";
import type { AsrSegment, AsrStatus, DubBuffer, Voice } from "@/types/models";

interface Props {
  isDark: boolean;
  buffer: DubBuffer;
  onChange: (partial: Partial<DubBuffer>) => void;
  asr: AsrStatus | null;
  /** Target voice picked in the library; null until chosen. */
  activeVoice: Voice | null;
  activeEngine: string | null;
  /** OmniVoice/VoxCPM expose Clone/Design/Auto; VoxCPM adds style-on-clone. */
  supportsVoiceModes: boolean;
  supportsStyleClone: boolean;
  /** Qwen: always-available free-text style prompt (no mode toggle). */
  supportsStylePrompt: boolean;
  onDownloadWeights: () => void;
}

const ACCEPT = ".wav,.mp3,.flac,.ogg,.m4a,.webm";

export function DubEditor({
  isDark,
  buffer,
  onChange,
  asr,
  activeVoice,
  activeEngine,
  supportsVoiceModes,
  supportsStyleClone,
  supportsStylePrompt,
  onDownloadWeights,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<null | "transcribe" | "dub">(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [audio, setAudio] = useState<{ data: ArrayBuffer; sampleRate: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<AudioPlayer>(new AudioPlayer());

  useEffect(() => () => playerRef.current.close(), []);

  const weightsMissing = asr != null && !asr.downloaded;
  const canTranscribe = !!file && !busy && !!asr && asr.downloaded;
  // Effective voice mode: engines with modes derive it (explicit > clone-if-voice
  // > auto); every other engine is always clone (voice required).
  const mode: VoiceMode = supportsVoiceModes
    ? effectiveMode({ voice: buffer.voiceId ?? "", omnivoiceMode: buffer.voiceMode })
    : "clone";
  const design = (buffer.voiceDesign ?? "").trim();
  // clone needs a reference voice; design/auto don't.
  const needsVoice = mode === "clone";
  const canDub = !busy && buffer.segments.length > 0 && (!needsVoice || !!activeVoice);

  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed((Date.now() - t0) / 1000), 100);
    return () => window.clearInterval(id);
  }, [busy]);

  const runTranscribe = useCallback(async () => {
    if (!file) return;
    setBusy("transcribe");
    setError(null);
    setElapsed(0);
    setAudio(null); // a new source invalidates any prior dub
    try {
      const res = await transcribe({ file, timestamps: true });
      onChange({
        segments: res.segments,
        detectedLanguage: res.language,
        fileName: file.name,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setBusy(null);
    }
  }, [file, onChange]);

  const runDub = useCallback(async () => {
    if (buffer.segments.length === 0) return;
    if (needsVoice && !activeVoice) return;
    // instruct carries the design/style/clone-style prompt (empty = omitted).
    // Mirrors TTS: design and clone (with style) forward it; auto never does.
    const instruct =
      mode === "design" || mode === "clone" ? (design || undefined) : undefined;
    setBusy("dub");
    setError(null);
    setElapsed(0);
    let res: { audio: ArrayBuffer; sampleRate: number };
    try {
      res = await dub({
        segments: buffer.segments.map((s) => ({ start: s.start, end: s.end, text: s.text })),
        voice: activeVoice?.id ?? "",
        engine: activeEngine ?? undefined,
        // Only mode-aware engines carry an explicit voice_mode; others stay clone.
        ...(supportsVoiceModes ? { voice_mode: mode } : {}),
        ...(instruct ? { instruct } : {}),
      });
      setAudio({ data: res.audio, sampleRate: res.sampleRate });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Dubbing failed");
      return;
    } finally {
      setBusy(null);
    }
    // Auto-play the fresh dub OUTSIDE the busy window, so the Generate button
    // re-enables immediately and playback is reflected only by the Play/Stop toggle.
    setPlaying(true);
    try {
      await playerRef.current.playPcm16(wavToPcm16(res.audio), res.sampleRate);
    } finally {
      setPlaying(false);
    }
  }, [activeVoice, activeEngine, buffer.segments, mode, design, needsVoice, supportsVoiceModes]);

  const togglePlay = useCallback(async () => {
    if (!audio) return;
    if (playing) {
      playerRef.current.stop();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    try {
      await playerRef.current.playPcm16(wavToPcm16(audio.data), audio.sampleRate);
    } finally {
      setPlaying(false);
    }
  }, [audio, playing]);

  const download = useCallback(() => {
    if (!audio) return;
    const url = URL.createObjectURL(new Blob([audio.data], { type: "audio/wav" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `dub-${(buffer.fileName || "audio").replace(/\.[^.]+$/, "")}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }, [audio, buffer.fileName]);

  const editSegment = (i: number, text: string) => {
    const next: AsrSegment[] = buffer.segments.map((s, idx) => (idx === i ? { ...s, text } : s));
    onChange({ segments: next });
    setAudio(null); // editing text invalidates the prior dub
  };

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    setFile(f);
    setError(null);
    setAudio(null);
  };

  const panel = isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const subtle = isDark ? "text-zinc-400" : "text-gray-600";
  const btn = `px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
    isDark
      ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700"
      : "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300"
  } ${focusRing}`;

  if (weightsMissing) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className={`max-w-2xl mx-auto p-6 rounded-xl border ${panel}`}>
          <h2 className={`text-lg font-semibold ${text}`}>Dubbing needs speech-to-text</h2>
          <p className={`text-sm mt-2 ${subtle}`}>
            Dubbing transcribes your clip with Whisper large-v3-turbo (about 1.6 GB), then re-voices
            it. It runs fully offline once downloaded.
          </p>
          <button
            type="button"
            onClick={onDownloadWeights}
            className={`mt-4 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium ${focusRing}`}
          >
            Download Whisper (1.6 GB)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {error && (
          <div
            className={`p-3 rounded-lg border text-sm ${
              isDark
                ? "bg-red-900/30 border-red-600/40 text-red-200"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {error}
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={`p-6 rounded-xl border-2 border-dashed text-center transition-colors ${
            dragOver ? "border-orange-500" : isDark ? "border-zinc-700" : "border-gray-300"
          } ${panel}`}
        >
          <FileAudio className="w-8 h-8 mx-auto mb-2 text-orange-400" />
          <p className={`text-sm ${text}`}>
            {file ? file.name : "Drop an audio clip to re-voice, or choose one"}
          </p>
          <p className={`text-xs mt-1 ${subtle}`}>Same-language re-voicing · WAV, MP3, FLAC, OGG, M4A, WebM</p>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <div className="flex items-center justify-center gap-2 mt-4">
            <button type="button" onClick={() => inputRef.current?.click()} className={btn}>
              <span className="flex items-center gap-1.5">
                <Upload className="w-4 h-4" /> Choose file
              </span>
            </button>
            <button
              type="button"
              onClick={() => void runTranscribe()}
              disabled={!canTranscribe}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${focusRing} ${
                canTranscribe ? "bg-orange-600 hover:bg-orange-500" : "bg-orange-600/40 cursor-not-allowed"
              }`}
            >
              {busy === "transcribe" ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" /> Transcribing… {elapsed.toFixed(1)}s
                </span>
              ) : (
                "Transcribe"
              )}
            </button>
          </div>
        </div>

        {buffer.segments.length > 0 && (
          <div className={`p-4 rounded-xl border ${panel}`}>
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className={`text-sm font-semibold ${text}`}>
                Transcript
                {buffer.detectedLanguage && (
                  <span className={`ml-2 font-normal ${subtle}`}>detected: {buffer.detectedLanguage}</span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${subtle}`}>
                  {mode === "design" ? (
                    "designed voice"
                  ) : mode === "auto" ? (
                    "auto voice"
                  ) : activeVoice ? (
                    <>
                      target voice: <span className={text}>{activeVoice.name}</span>
                    </>
                  ) : (
                    "pick a target voice in the library →"
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => void runDub()}
                  disabled={!canDub}
                  title={needsVoice && !activeVoice ? "Pick a target voice in the library first" : "Re-voice the clip"}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${focusRing} ${
                    canDub ? "bg-orange-600 hover:bg-orange-500" : "bg-orange-600/40 cursor-not-allowed"
                  }`}
                >
                  {busy === "dub" ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin" /> Dubbing… {elapsed.toFixed(1)}s
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <AudioLines className="w-4 h-4" /> Generate Dub
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Qwen always-available style prompt (built-in voice + optional style) */}
            {supportsStylePrompt && (
              <input
                type="text"
                value={buffer.voiceDesign ?? ""}
                onChange={(e) => onChange({ voiceDesign: e.target.value })}
                placeholder="Style (optional) — e.g. cheerful, slightly faster, whispering"
                className={`mb-3 w-full border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-orange-500 ${
                  isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-gray-200 text-gray-900"
                } ${focusRing}`}
              />
            )}

            {/* OmniVoice / VoxCPM voice mode: Clone / Design / Auto */}
            {supportsVoiceModes && (
              <div className={`mb-3 rounded-lg border p-3 space-y-2 ${isDark ? "border-zinc-800 bg-zinc-950/40" : "border-gray-200 bg-gray-50"}`}>
                <div className="flex gap-1.5">
                  {(["clone", "design", "auto"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onChange({ voiceMode: m })}
                      className={`flex-1 px-3 py-1.5 text-sm font-medium rounded capitalize transition-colors ${
                        mode === m
                          ? "bg-orange-600 text-white"
                          : isDark
                            ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      } ${focusRing}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {mode === "clone" && (
                  <div className="space-y-1.5">
                    <p className={`text-xs ${subtle}`}>
                      Re-voices the clip in the library voice:{" "}
                      <span className="text-orange-400">{activeVoice ? activeVoice.name : "none selected"}</span>
                    </p>
                    {supportsStyleClone && (
                      <input
                        type="text"
                        value={buffer.voiceDesign ?? ""}
                        onChange={(e) => onChange({ voiceDesign: e.target.value })}
                        placeholder="Style (optional) — e.g. cheerful, slightly faster"
                        className={`w-full border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-orange-500 ${
                          isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-gray-200 text-gray-900"
                        } ${focusRing}`}
                      />
                    )}
                  </div>
                )}
                {mode === "design" && (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={buffer.voiceDesign ?? ""}
                      onChange={(e) => onChange({ voiceDesign: e.target.value })}
                      placeholder={activeEngine === "voxcpm" ? "e.g. a young woman, gentle and sweet" : "e.g. female, low pitch, british accent"}
                      className={`w-full border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-orange-500 ${
                        isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-gray-200 text-gray-900"
                      } ${focusRing}`}
                    />
                    {activeEngine === "omnivoice" && (
                      <div className="flex flex-wrap gap-1">
                        {DESIGN_CHIPS.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => onChange({ voiceDesign: appendDesignChip(buffer.voiceDesign ?? "", chip) })}
                            className={`px-1.5 py-0.5 text-[11px] rounded border transition-colors ${
                              isDark
                                ? "border-zinc-700 text-zinc-400 hover:border-orange-500 hover:text-orange-300"
                                : "border-gray-300 text-gray-600 hover:border-orange-500 hover:text-orange-600"
                            } ${focusRing}`}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {mode === "auto" && (
                  <p className={`text-xs italic ${subtle}`}>
                    {activeEngine === "voxcpm"
                      ? "VoxCPM will design a fresh voice for the clip."
                      : "OmniVoice will invent a voice for the clip."}
                  </p>
                )}
              </div>
            )}

            <ul className="space-y-2">
              {buffer.segments.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className={`tabular-nums text-xs pt-2.5 shrink-0 ${subtle}`}>
                    [{s.start.toFixed(2)}–{s.end.toFixed(2)}]
                  </span>
                  <input
                    value={s.text}
                    onChange={(e) => editSegment(i, e.target.value)}
                    spellCheck={false}
                    dir={textDirection(s.text)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                      isRtlText(s.text) ? "text-right" : "text-left"
                    } ${
                      isDark
                        ? "bg-zinc-950 border-zinc-800 text-zinc-100"
                        : "bg-white border-gray-200 text-gray-900"
                    } ${focusRing}`}
                  />
                </li>
              ))}
            </ul>

            {audio && (
              <div className="flex items-center gap-2 mt-4">
                <button type="button" onClick={() => void togglePlay()} className={btn}>
                  <span className="flex items-center gap-1.5">
                    {playing ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {playing ? "Stop" : "Play dub"}
                  </span>
                </button>
                <button type="button" onClick={download} className={btn}>
                  <span className="flex items-center gap-1.5">
                    <Download className="w-4 h-4" /> Download WAV
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
