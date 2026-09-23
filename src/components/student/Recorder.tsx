"use client";

import { useEffect, useState } from "react";
import {
  Mic,
  Pause,
  Play,
  Square,
  RotateCcw,
  X,
  BookOpen,
  AlertTriangle,
  Plus,
  Trash2,
  CalendarClock,
  CalendarDays,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { formatMs } from "@/lib/format";
import { getParasForRange, PARAS } from "@/lib/quran/paras";
import {
  QuarterNumber,
  QUARTER_LABELS,
  guessQuarter,
} from "@/lib/quran/quarters";
import SurahSelector from "./SurahSelector";
import QariPicker from "./QariPicker";

interface Props {
  studentName: string;
}

interface StudentMistakeDraft {
  id: string;
  timestampSec: number;
  category: string;
  severity: string;
  description: string;
}

const CATEGORIES = [
  "TAJWEED",
  "PRONUNCIATION",
  "MADD",
  "MAKHARIJ",
  "GHUNNAH",
  "WAQF",
  "GENERAL",
  "OTHER",
];

const SEVERITIES = ["MINOR", "MEDIUM", "MAJOR"];

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function Recorder({ studentName }: Props) {
  const router = useRouter();
  const rec = useMediaRecorder();

  const [surahNumber, setSurahNumber] = useState(1);
  const [ayahFrom, setAyahFrom] = useState(1);
  const [ayahTo, setAyahTo] = useState(7);
  const [paraQuarter, setParaQuarter] = useState<QuarterNumber | null>(null);
  const [notes, setNotes] = useState("");
  const [qariId, setQariId] = useState<string | null>(null);

  // Backdating support
  const [dateMode, setDateMode] = useState<"today" | "custom">("today");
  const [customDate, setCustomDate] = useState<string>(todayIso());

  const [studentMistakes, setStudentMistakes] = useState<StudentMistakeDraft[]>(
    []
  );

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const paraRange = getParasForRange(surahNumber, ayahFrom, surahNumber, ayahTo);
  const singlePara =
    paraRange && paraRange.paraFrom === paraRange.paraTo
      ? paraRange.paraFrom
      : null;
  const paraLabel = paraRange
    ? paraRange.paraFrom === paraRange.paraTo
      ? `Para ${paraRange.paraFrom} — ${
          PARAS[paraRange.paraFrom - 1]?.name ?? ""
        }`
      : `Paras ${paraRange.paraFrom}–${paraRange.paraTo}`
    : null;

  useEffect(() => {
    if (singlePara) {
      const g = guessQuarter(singlePara, surahNumber, ayahFrom);
      setParaQuarter(g);
    } else {
      setParaQuarter(null);
    }
  }, [singlePara, surahNumber, ayahFrom]);

  async function handleStart() {
    setUploadError(null);
    setStudentMistakes([]);
    await rec.start();
  }

  function handleRetake() {
    rec.reset();
    setUploadError(null);
    setUploadProgress(0);
    setQueued(false);
    setStudentMistakes([]);
  }

  function handleCancel() {
    rec.reset();
    setStudentMistakes([]);
  }

  function addStudentMistake() {
    setStudentMistakes((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        timestampSec: 0,
        category: "GENERAL",
        severity: "MINOR",
        description: "",
      },
    ]);
  }

  function updateStudentMistake(
    id: string,
    patch: Partial<StudentMistakeDraft>
  ) {
    setStudentMistakes((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );
  }

  function removeStudentMistake(id: string) {
    setStudentMistakes((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleSave() {
    if (!rec.take || uploading) return;
    setUploadError(null);
    setUploading(true);
    setUploadProgress(0);

    const timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

    const cleanedMistakes = studentMistakes
      .filter((m) => m.description.trim().length > 0)
      .map((m) => ({
        timestampMs: Math.max(0, Math.round(m.timestampSec * 1000)),
        category: m.category,
        severity: m.severity,
        description: m.description.trim(),
      }));

    const backdateValue =
      dateMode === "custom" && customDate ? customDate : null;

    const payload = {
      blob: rec.take.blob,
      mimeType: rec.take.mimeType,
      durationMs: rec.take.durationMs,
      surahNumber,
      ayahFrom,
      ayahTo,
      paraNumber: paraRange?.paraFrom ?? null,
      paraFrom: paraRange?.paraFrom ?? null,
      paraTo: paraRange?.paraTo ?? null,
      paraQuarter,
      qariId,
      notes,
      timezone,
      studentMistakes: cleanedMistakes,
      recordedAt: backdateValue,
    };

    try {
      const form = new FormData();
      const ext = extensionFromMime(rec.take.mimeType);
      form.append("audio", rec.take.blob, `recording.${ext}`);
      form.append("surahNumber", String(surahNumber));
      form.append("ayahFrom", String(ayahFrom));
      form.append("ayahTo", String(ayahTo));
      if (paraRange) {
        form.append("paraFrom", String(paraRange.paraFrom));
        form.append("paraTo", String(paraRange.paraTo));
      }
      if (paraQuarter != null) {
        form.append("paraQuarter", String(paraQuarter));
      }
      if (qariId) form.append("qariId", qariId);
      form.append("durationMs", String(rec.take.durationMs));
      form.append("notes", notes);
      form.append("timezone", timezone);
      if (cleanedMistakes.length > 0) {
        form.append("studentMistakes", JSON.stringify(cleanedMistakes));
      }
      if (backdateValue) {
        form.append("recordedAt", backdateValue);
      }

      const { status, body } = await uploadWithProgress(
        "/api/recordings",
        form,
        setUploadProgress
      );

      if (status >= 200 && status < 300) {
        router.push("/student");
        router.refresh();
        return;
      }
      if (status >= 400 && status < 500) {
        throw new Error(body?.error ?? `Upload failed (${status}).`);
      }
      throw new Error("SERVER_ERROR");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const shouldQueue =
        msg === "SERVER_ERROR" ||
        msg === "Network error during upload." ||
        msg === "Upload timed out." ||
        msg === "Failed to fetch" ||
        !navigator.onLine;

      if (shouldQueue) {
        try {
          const { enqueue } = await import("@/lib/offline/queue");
          await enqueue(payload);
          setUploading(false);
          setQueued(true);
          return;
        } catch (queueErr) {
          console.error("[handleSave] queue failed", queueErr);
          const detail =
            queueErr instanceof Error ? queueErr.message : "unknown error";
          setUploadError(`Could not save locally: ${detail}`);
          setUploading(false);
          return;
        }
      }
      setUploadError(msg || "Upload failed. Please try again.");
      setUploading(false);
    }
  }

  if (rec.status === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <h2 className="text-sm font-semibold text-red-900">Recording error</h2>
        <p className="mt-1 text-sm text-red-800">{rec.error}</p>
        <button
          onClick={handleRetake}
          className="mt-4 rounded-md border border-red-300 bg-white px-4 py-2 text-sm text-red-900"
        >
          Try again
        </button>
      </div>
    );
  }

  if (
    rec.status === "requesting-permission" ||
    rec.status === "recording" ||
    rec.status === "paused"
  ) {
    return (
      <LiveView
        studentName={studentName}
        status={rec.status}
        durationMs={rec.liveDurationMs}
        level={rec.level}
        onPause={rec.pause}
        onResume={rec.resume}
        onStop={rec.stop}
        onCancel={handleCancel}
      />
    );
  }

  if (rec.status === "stopped" && rec.take) {
    return (
      <PreviewView
        studentName={studentName}
        durationMs={rec.take.durationMs}
        blob={rec.take.blob}
        mimeType={rec.take.mimeType}
        surahNumber={surahNumber}
        ayahFrom={ayahFrom}
        ayahTo={ayahTo}
        paraLabel={paraLabel}
        paraQuarter={paraQuarter}
        notes={notes}
        mistakeCount={studentMistakes.filter(
          (m) => m.description.trim().length > 0
        ).length}
        dateLabel={
          dateMode === "custom"
            ? new Date(customDate + "T12:00:00").toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "Today"
        }
        uploading={uploading}
        uploadProgress={uploadProgress}
        uploadError={uploadError}
        queued={queued}
        onRetake={handleRetake}
        onSave={handleSave}
        onBack={() => router.push("/student")}
      />
    );
  }

  return (
    <SetupView
      studentName={studentName}
      surahNumber={surahNumber}
      ayahFrom={ayahFrom}
      ayahTo={ayahTo}
      paraLabel={paraLabel}
      singlePara={singlePara}
      paraQuarter={paraQuarter}
      onQuarterChange={setParaQuarter}
      notes={notes}
      qariId={qariId}
      onQariChange={setQariId}
      dateMode={dateMode}
      customDate={customDate}
      onDateModeChange={setDateMode}
      onCustomDateChange={setCustomDate}
      onSurahChange={(v) => {
        setSurahNumber(v.surahNumber);
        setAyahFrom(v.ayahFrom);
        setAyahTo(v.ayahTo);
      }}
      onNotesChange={setNotes}
      onStart={handleStart}
    />
  );
}

function extensionFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  return "bin";
}

interface UploadResult {
  status: number;
  body: { error?: string; recording?: { id: string } } | null;
}

function uploadWithProgress(
  url: string,
  form: FormData,
  onProgress: (pct: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      let body: UploadResult["body"] = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      onProgress(100);
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.ontimeout = () => reject(new Error("Upload timed out."));
    xhr.send(form);
  });
}

// ==================== SETUP VIEW ====================

function SetupView({
  studentName,
  surahNumber,
  ayahFrom,
  ayahTo,
  paraLabel,
  singlePara,
  paraQuarter,
  onQuarterChange,
  notes,
  qariId,
  onQariChange,
  dateMode,
  customDate,
  onDateModeChange,
  onCustomDateChange,
  onSurahChange,
  onNotesChange,
  onStart,
}: {
  studentName: string;
  surahNumber: number;
  ayahFrom: number;
  ayahTo: number;
  paraLabel: string | null;
  singlePara: number | null;
  paraQuarter: QuarterNumber | null;
  onQuarterChange: (q: QuarterNumber) => void;
  notes: string;
  qariId: string | null;
  onQariChange: (id: string | null) => void;
  dateMode: "today" | "custom";
  customDate: string;
  onDateModeChange: (m: "today" | "custom") => void;
  onCustomDateChange: (iso: string) => void;
  onSurahChange: (v: {
    surahNumber: number;
    ayahFrom: number;
    ayahTo: number;
  }) => void;
  onNotesChange: (v: string) => void;
  onStart: () => void;
}) {
  const today = todayIso();
  const maxDate = today; // can't pick a future date

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          New recitation
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          {studentName}
        </h1>
      </header>

      <div className="space-y-6">
        {/* ---- DATE PICKER ---- */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-neutral-800">
            <CalendarClock className="h-4 w-4" aria-hidden />
            When was this recited?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onDateModeChange("today")}
              className={`flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm font-medium ${
                dateMode === "today"
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500"
              }`}
            >
              <CalendarDays className="h-4 w-4" aria-hidden />
              Today
            </button>
            <button
              type="button"
              onClick={() => onDateModeChange("custom")}
              className={`flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-sm font-medium ${
                dateMode === "custom"
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500"
              }`}
            >
              <CalendarClock className="h-4 w-4" aria-hidden />
              Custom date
            </button>
          </div>

          {dateMode === "custom" && (
            <div className="mt-2">
              <label
                htmlFor="customDate"
                className="block text-xs font-medium text-neutral-600"
              >
                Pick a date (past)
              </label>
              <input
                id="customDate"
                type="date"
                value={customDate}
                max={maxDate}
                onChange={(e) => onCustomDateChange(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-3 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-neutral-500">
                Attendance for this date will be marked automatically.
              </p>
            </div>
          )}
        </div>

        <SurahSelector
          surahNumber={surahNumber}
          ayahFrom={ayahFrom}
          ayahTo={ayahTo}
          onChange={onSurahChange}
        />

        {paraLabel && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              Para (auto-detected)
            </div>
            <p className="mt-0.5 text-sm font-medium text-neutral-900">
              {paraLabel}
            </p>
          </div>
        )}

        {singlePara && (
          <div>
            <p className="text-sm font-medium text-neutral-800">
              Which quarter of this para?
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {([1, 2, 3, 4] as QuarterNumber[]).map((q) => {
                const active = paraQuarter === q;
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onQuarterChange(q)}
                    className={`rounded-md border px-2 py-2.5 text-xs font-medium ${
                      active
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 bg-white text-neutral-800 hover:border-neutral-500"
                    }`}
                  >
                    {QUARTER_LABELS[q]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <QariPicker value={qariId} onChange={onQariChange} />

        <div>
          <label
            htmlFor="notes"
            className="block text-sm font-medium text-neutral-800"
          >
            Notes <span className="text-neutral-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Anything to remember about this recitation…"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
          />
        </div>

        <button
          onClick={onStart}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-neutral-900 px-5 py-5 text-base font-medium text-white disabled:opacity-60"
        >
          <Mic className="h-6 w-6" aria-hidden />
          Start recording
        </button>
        <p className="text-center text-xs text-neutral-500">
          Your browser will ask to use the microphone the first time.
        </p>
      </div>
    </div>
  );
}

// ==================== LIVE VIEW ====================

function LiveView({
  studentName,
  status,
  durationMs,
  level,
  onPause,
  onResume,
  onStop,
  onCancel,
}: {
  studentName: string;
  status: string;
  durationMs: number;
  level: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onCancel: () => void;
}) {
  const isPaused = status === "paused";
  const isStarting = status === "requesting-permission";

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-neutral-500">
            Recording
          </p>
          <h1 className="mt-1 text-base font-medium text-neutral-900">
            {studentName}
          </h1>
        </div>
        <button
          onClick={onCancel}
          aria-label="Cancel recording"
          className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <div className="flex flex-col items-center rounded-xl border border-neutral-200 bg-white px-6 py-10">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            isStarting
              ? "bg-neutral-100 text-neutral-800"
              : isPaused
              ? "bg-amber-100 text-amber-900"
              : "bg-red-100 text-red-900"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isStarting
                ? "bg-neutral-500"
                : isPaused
                ? "bg-amber-600"
                : "animate-pulse bg-red-600"
            }`}
          />
          {isStarting ? "STARTING" : isPaused ? "PAUSED" : "RECORDING"}
        </span>

        <div
          className="mt-6 font-mono text-5xl font-semibold tracking-tight text-neutral-900"
          aria-live="polite"
        >
          {formatMs(durationMs)}
        </div>

        <Waveform active={!isPaused && !isStarting} level={level} />

        <div className="mt-8 flex w-full items-center justify-center gap-4">
          {isPaused ? (
            <button
              onClick={onResume}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-900 text-white"
              aria-label="Resume recording"
            >
              <Play className="h-7 w-7" aria-hidden />
            </button>
          ) : (
            <button
              onClick={onPause}
              disabled={isStarting}
              className="flex h-16 w-16 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-900 disabled:opacity-40"
              aria-label="Pause recording"
            >
              <Pause className="h-7 w-7" aria-hidden />
            </button>
          )}

          <button
            onClick={onStop}
            disabled={isStarting}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600 text-white shadow-sm disabled:opacity-40"
            aria-label="Stop recording"
          >
            <Square className="h-8 w-8 fill-current" aria-hidden />
          </button>

          <div className="h-16 w-16" aria-hidden />
        </div>

        <p className="mt-6 text-xs text-neutral-500">
          {isStarting
            ? "Requesting microphone access…"
            : isPaused
            ? "Recording is paused. Tap play to continue."
            : "Recording is in progress. Tap stop when finished."}
        </p>
      </div>
    </div>
  );
}

function Waveform({ active, level }: { active: boolean; level: number }) {
  const bars = 24;
  return (
    <div
      className="mt-8 flex h-16 w-full items-end justify-center gap-[3px]"
      aria-hidden
    >
      {Array.from({ length: bars }).map((_, i) => {
        const centered = 1 - Math.abs(i - (bars - 1) / 2) / (bars / 2);
        const baseHeight = 4 + centered * 8;
        const dynamicHeight = active ? level * 40 * centered : 0;
        const h = Math.max(4, Math.min(64, baseHeight + dynamicHeight));
        return (
          <span
            key={i}
            className={`w-[3px] rounded-full ${
              active ? "bg-neutral-800" : "bg-neutral-300"
            }`}
            style={{ height: `${h}px`, transition: "height 80ms linear" }}
          />
        );
      })}
    </div>
  );
}

// ==================== PREVIEW ====================

function PreviewView({
  studentName,
  durationMs,
  blob,
  mimeType,
  surahNumber,
  ayahFrom,
  ayahTo,
  paraLabel,
  paraQuarter,
  notes,
  mistakeCount,
  dateLabel,
  uploading,
  uploadProgress,
  uploadError,
  queued,
  onRetake,
  onSave,
  onBack,
}: {
  studentName: string;
  durationMs: number;
  blob: Blob | null;
  mimeType: string;
  surahNumber: number;
  ayahFrom: number;
  ayahTo: number;
  paraLabel: string | null;
  paraQuarter: QuarterNumber | null;
  notes: string;
  mistakeCount: number;
  dateLabel: string;
  uploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  queued: boolean;
  onRetake: () => void;
  onSave: () => void;
  onBack: () => void;
}) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Review your recording
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">
          {studentName}
        </h1>
      </header>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <dt className="text-neutral-500">Date</dt>
          <dd className="text-right font-medium text-neutral-900">
            {dateLabel}
          </dd>
          <dt className="text-neutral-500">Surah</dt>
          <dd className="text-right font-medium text-neutral-900">
            {surahNumber}
          </dd>
          <dt className="text-neutral-500">Ayah range</dt>
          <dd className="text-right font-medium text-neutral-900">
            {ayahFrom}–{ayahTo}
          </dd>
          {paraLabel && (
            <>
              <dt className="text-neutral-500">Para</dt>
              <dd className="text-right font-medium text-neutral-900">
                {paraLabel.replace("Para ", "").replace(/ —.*/, "")}
              </dd>
            </>
          )}
          {paraQuarter != null && (
            <>
              <dt className="text-neutral-500">Quarter</dt>
              <dd className="text-right font-medium text-neutral-900">
                {QUARTER_LABELS[paraQuarter]}
              </dd>
            </>
          )}
          <dt className="text-neutral-500">Duration</dt>
          <dd className="text-right font-mono font-medium text-neutral-900">
            {formatMs(durationMs)}
          </dd>
        </dl>

        {notes && (
          <div className="mt-4 border-t border-neutral-100 pt-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Notes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">
              {notes}
            </p>
          </div>
        )}
      </div>

      {audioUrl && (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
          <audio src={audioUrl} controls preload="metadata" className="w-full" />
        </div>
      )}

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          Mistakes you noticed (optional)
        </h2>
        <p className="mt-1 text-xs text-amber-800">
          Anything you know you slipped on? Add it here so the qari can confirm.
        </p>
        {mistakeCount > 0 && (
          <p className="mt-2 text-xs font-medium text-amber-900">
            {mistakeCount} mistake{mistakeCount === 1 ? "" : "s"} added.
          </p>
        )}
      </div>

      {uploadError && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {uploadError}
        </p>
      )}

      {uploading && (
        <div className="mt-4 rounded-md border border-neutral-200 bg-white p-3">
          <div className="flex items-center justify-between text-xs text-neutral-700">
            <span>Uploading…</span>
            <span className="font-mono">{uploadProgress}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full bg-neutral-900 transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {queued && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3">
          <p className="text-sm font-medium text-emerald-900">
            Saved on this device.
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            The recording will upload automatically when the internet returns.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {!queued && (
          <button
            onClick={onSave}
            disabled={uploading}
            className="w-full rounded-lg bg-neutral-900 px-5 py-4 text-base font-medium text-white disabled:opacity-60"
          >
            {uploading
              ? "Uploading…"
              : mistakeCount > 0
              ? `Save with ${mistakeCount} mistake${
                  mistakeCount === 1 ? "" : "s"
                }`
              : "Save recording"}
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          {!queued && (
            <button
              onClick={onRetake}
              disabled={uploading}
              className="flex items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-800 disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Retake
            </button>
          )}
          <button
            onClick={onBack}
            disabled={uploading}
            className={`rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-800 disabled:opacity-60 ${
              queued ? "col-span-2" : ""
            }`}
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}