"use client";

import { useEffect, useState } from "react";
import { Mic, Pause, Play, Square, RotateCcw, X, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { formatMs } from "@/lib/format";
import { getParasForRange, PARAS } from "@/lib/quran/paras";
import SurahSelector from "./SurahSelector";
import QariPicker from "./QariPicker";

interface Props {
  studentName: string;
}

export default function Recorder({ studentName }: Props) {
  const router = useRouter();
  const rec = useMediaRecorder();

  const [surahNumber, setSurahNumber] = useState(1);
  const [ayahFrom, setAyahFrom] = useState(1);
  const [ayahTo, setAyahTo] = useState(7);
  const [notes, setNotes] = useState("");
  const [qariId, setQariId] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const paraRange = getParasForRange(surahNumber, ayahFrom, surahNumber, ayahTo);
  const paraLabel = paraRange
    ? paraRange.paraFrom === paraRange.paraTo
      ? `Para ${paraRange.paraFrom} — ${PARAS[paraRange.paraFrom - 1]?.name ?? ""}`
      : `Paras ${paraRange.paraFrom}–${paraRange.paraTo}`
    : null;

  async function handleStart() {
    setUploadError(null);
    await rec.start();
  }

  function handleRetake() {
    rec.reset();
    setUploadError(null);
    setUploadProgress(0);
    setQueued(false);
  }

  function handleCancel() {
    rec.reset();
  }

  async function handleSave() {
    if (!rec.take || uploading) return;
    setUploadError(null);
    setUploading(true);
    setUploadProgress(0);

    const timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
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
      qariId,
      notes,
      timezone,
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
      if (qariId) form.append("qariId", qariId);
      form.append("durationMs", String(rec.take.durationMs));
      form.append("notes", notes);
      form.append("timezone", timezone);

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
        notes={notes}
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
      notes={notes}
      qariId={qariId}
      onQariChange={setQariId}
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

// ---------- Setup ----------

function SetupView({
  studentName,
  surahNumber,
  ayahFrom,
  ayahTo,
  paraLabel,
  notes,
  qariId,
  onQariChange,
  onSurahChange,
  onNotesChange,
  onStart,
}: {
  studentName: string;
  surahNumber: number;
  ayahFrom: number;
  ayahTo: number;
  paraLabel: string | null;
  notes: string;
  qariId: string | null;
  onQariChange: (id: string | null) => void;
  onSurahChange: (v: {
    surahNumber: number;
    ayahFrom: number;
    ayahTo: number;
  }) => void;
  onNotesChange: (v: string) => void;
  onStart: () => void;
}) {
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

// ---------- Live ----------

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

// ---------- Preview ----------

function PreviewView({
  studentName,
  durationMs,
  blob,
  mimeType,
  surahNumber,
  ayahFrom,
  ayahTo,
  paraLabel,
  notes,
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
  notes: string;
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
          <dt className="text-neutral-500">Duration</dt>
          <dd className="text-right font-mono font-medium text-neutral-900">
            {formatMs(durationMs)}
          </dd>
          <dt className="text-neutral-500">Format</dt>
          <dd className="text-right font-mono text-xs text-neutral-700">
            {mimeType || "unknown"}
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
            {uploading ? "Uploading…" : "Save recording"}
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