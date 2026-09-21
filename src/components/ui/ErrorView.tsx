"use client";

import { AlertTriangle } from "lucide-react";

export default function ErrorView({
  title = "Something went wrong",
  message = "We couldn't load this page. Try again, or go back to the previous screen.",
  onReset,
}: {
  title?: string;
  message?: string;
  onReset?: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-900">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-neutral-900">{title}</h1>
      <p className="mt-2 text-sm text-neutral-600">{message}</p>
      <div className="mt-6 flex items-center gap-3">
        {onReset && (
          <button
            onClick={onReset}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
          >
            Try again
          </button>
        )}
        <button
          onClick={() => {
            window.location.href = "/";
          }}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800"
        >
          Back to home
        </button>
      </div>
    </main>
  );
}