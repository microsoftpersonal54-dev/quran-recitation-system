import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const count = await db.user.count();
  if (count > 0) redirect("/login");

  return (
    <main className="mx-auto max-w-xl px-5 py-10 sm:py-16">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          First-time setup
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
          Create your accounts
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          This page is only available once. After you finish, it will be locked
          and you will be signed in as the Father.
        </p>
      </header>
      <SetupForm />
    </main>
  );
}