"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Bell } from "lucide-react";

interface Props {
  unreadCount?: number;
}

export default function QariNav({ unreadCount = 0 }: Props) {
  const pathname = usePathname();

  const items = [
    { href: "/qari", label: "Review", Icon: ClipboardList },
    {
      href: "/qari/notifications",
      label: "Alerts",
      Icon: Bell,
      badge: unreadCount,
    },
  ];

  return (
    <nav
      aria-label="Qari navigation"
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-neutral-200 bg-white"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-2xl">
        {items.map(({ href, label, Icon, badge }) => {
          const active =
            href === "/qari"
              ? pathname === "/qari"
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
                <span className="relative">
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={active ? 2.3 : 1.8}
                    aria-hidden
                  />
                  {badge != null && badge > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span className="font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}