import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-10 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-neutral-900">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        The page you're looking for doesn't exist, or you don't have access to
        it.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
      >
        Go to home
      </Link>
    </main>
  );
}