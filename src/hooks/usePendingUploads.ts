"use client";

import { useCallback, useEffect, useState } from "react";
import { listPending, PendingUpload } from "@/lib/offline/db";
import { flushQueue, tryUploadItem } from "@/lib/offline/queue";

export function usePendingUploads() {
  const [items, setItems] = useState<PendingUpload[]>([]);
  const [online, setOnline] = useState(true);
  const [flushing, setFlushing] = useState(false);

  const refresh = useCallback(async () => {
    const list = await listPending();
    setItems(list);
  }, []);

  const flush = useCallback(async () => {
    if (flushing) return;
    setFlushing(true);
    try {
      await flushQueue();
      await refresh();
    } finally {
      setFlushing(false);
    }
  }, [flushing, refresh]);

  const retryOne = useCallback(
    async (id: string) => {
      const item = (await listPending()).find((x) => x.id === id);
      if (!item) return;
      await tryUploadItem(item);
      await refresh();
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
    setOnline(navigator.onLine);

    const onOnline = () => {
      setOnline(true);
      flush();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Also try flushing every 30s while online.
    const interval = setInterval(() => {
      if (navigator.onLine) flush();
    }, 30_000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, [flush, refresh]);

  return { items, online, flushing, refresh, flush, retryOne };
}