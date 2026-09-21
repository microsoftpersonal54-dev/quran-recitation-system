import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, homeForRole } from "@/lib/auth/session";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const count = await db.user.count();
  if (count === 0) redirect("/setup");

  const user = await getCurrentUser();
  if (user) redirect(homeForRole(user.role));

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="text-2xl font-semibold text-neutral-900">Sign in</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Use the account given to you by the family administrator.
      </p>
      <div className="mt-8">
        <LoginForm />
      </div>
    </main>
  );
}