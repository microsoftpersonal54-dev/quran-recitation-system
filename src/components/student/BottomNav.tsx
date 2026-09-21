"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Mic, TrendingUp } from "lucide-react";

const items = [
  { href: "/student", label: "Home", Icon: Home },
  { href: "/student/record", label: "Record", Icon: Mic },
  { href: "/student/progress", label: "Progress", Icon: TrendingUp },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Student navigation"
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-neutral-200 bg-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md">
        {items.map(({ href, label, Icon }) => {
          const active =
            href === "/student"
              ? pathname === "/student"
              : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-3 py-2 text-[11px] ${
                  active
                    ? "text-neutral-900"
                    : "text-neutral-500 hover:text-neutral-800"
                }`}
              >
                <Icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2.3 : 1.8}
                  aria-hidden
                />
                <span className="font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}