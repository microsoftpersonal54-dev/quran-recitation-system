"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MarkReadOnVisit() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetch("/api/notifications", { method: "PATCH" });
        if (!cancelled) {
          router.refresh();
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}