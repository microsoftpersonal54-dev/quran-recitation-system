"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "paused"
  | "stopped"
  | "error";

export interface RecordedTake {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  createdAt: Date;
}

export interface UseMediaRecorderResult {
  status: RecorderStatus;
  error: string | null;
  permission: "unknown" | "granted" | "denied";
  liveDurationMs: number;
  level: number;
  take: RecordedTake | null;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export function useMediaRecorder(): UseMediaRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<"unknown" | "granted" | "denied">(
    "unknown"
  );
  const [liveDurationMs, setLiveDurationMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [take, setTake] = useState<RecordedTake | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("");
  const startedAtRef = useRef<number>(0);
  const pausedTotalMsRef = useRef<number>(0);
  const pauseStartedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearTick = () => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const clearLevelLoop = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const teardownStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearTick();
      clearLevelLoop();
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      teardownStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teardownStream]);

  const start = useCallback(async () => {
    setError(null);
    setTake(null);
    setLiveDurationMs(0);
    setLevel(0);
    setStatus("requesting-permission");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setStatus("error");
      setError(
        "This browser does not support audio recording. Try Chrome or Safari."
      );
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermission("granted");
    } catch (err) {
      setPermission("denied");
      setStatus("error");
      const name = (err as { name?: string })?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError(
          "Microphone access was denied. Allow microphone permission in your browser settings and try again."
        );
      } else if (name === "NotFoundError") {
        setError("No microphone was found on this device.");
      } else {
        setError("Could not start the microphone. Please try again.");
      }
      return;
    }

    streamRef.current = stream;

    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctor) {
        const ctx = new Ctor();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;

        const buf = new Uint8Array(analyser.fftSize);
        let frame = 0;
        const loop = () => {
          if (!analyserRef.current) return;
          frame++;
          if (frame % 3 === 0) {
            analyserRef.current.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / buf.length);
            setLevel(Math.min(1, rms * 3));
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      }
    } catch {
      /* level meter is optional */
    }

    const mimeType = pickMimeType();
    mimeTypeRef.current = mimeType;

    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      teardownStream();
      setStatus("error");
      setError("This browser could not create a recorder.");
      return;
    }

    chunksRef.current = [];

    recorder.addEventListener("dataavailable", (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    });

    recorder.addEventListener("stop", () => {
      clearTick();
      clearLevelLoop();
      const finalMime =
        mimeTypeRef.current || chunksRef.current[0]?.type || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: finalMime });
      const durationMs = startedAtRef.current
        ? Date.now() - startedAtRef.current - pausedTotalMsRef.current
        : 0;
      setTake({
        blob,
        mimeType: finalMime,
        durationMs: Math.max(0, durationMs),
        createdAt: new Date(),
      });
      setLiveDurationMs(0);
      setLevel(0);
      setStatus("stopped");
      teardownStream();
    });

    mediaRecorderRef.current = recorder;
    startedAtRef.current = Date.now();
    pausedTotalMsRef.current = 0;
    pauseStartedAtRef.current = 0;

    tickRef.current = window.setInterval(() => {
      const total =
        Date.now() - startedAtRef.current - pausedTotalMsRef.current;
      setLiveDurationMs(Math.max(0, total));
    }, 200);

    recorder.start(250);
    setStatus("recording");
  }, [teardownStream]);

  const pause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    pauseStartedAtRef.current = Date.now();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    if (pauseStartedAtRef.current) {
      pausedTotalMsRef.current += Date.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = 0;
    }
    recorder.resume();
    setStatus("recording");
  }, []);

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (pauseStartedAtRef.current) {
      pausedTotalMsRef.current += Date.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = 0;
    }
    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const reset = useCallback(() => {
    clearTick();
    clearLevelLoop();
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      /* ignore */
    }
    teardownStream();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = 0;
    pausedTotalMsRef.current = 0;
    pauseStartedAtRef.current = 0;
    setTake(null);
    setLiveDurationMs(0);
    setLevel(0);
    setError(null);
    setStatus("idle");
  }, [teardownStream]);

  return {
    status,
    error,
    permission,
    liveDurationMs,
    level,
    take,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}