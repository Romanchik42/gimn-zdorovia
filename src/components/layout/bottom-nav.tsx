"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UtensilsCrossedIcon,
  TrendingUpIcon,
  SettingsIcon,
  DumbbellIcon,
} from "lucide-react";

import { cn } from "cn";

/** Нижняя навигация. Единый список — чтобы пункты не разъезжались по экранам. */
const ITEMS = [
  { href: "/app", label: "Сегодня", icon: HomeIcon, tour: "nav-today" },
  { href: "/app/exercises", label: "Каталог", icon: DumbbellIcon, tour: "nav-exercises" },
  { href: "/app/nutrition", label: "Питание", icon: UtensilsCrossedIcon, tour: "nav-nutrition" },
  { href: "/app/progress", label: "Прогресс", icon: TrendingUpIcon, tour: "nav-progress" },
  { href: "/app/settings", label: "Ещё", icon: SettingsIcon, tour: "nav-settings" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      data-tour="bottom-nav"
      className="sticky bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      aria-label="Основная навигация"
    >
      <ul className="mx-auto flex max-w-md">
        {ITEMS.map(({ href, label, icon: Icon, tour }) => {
          const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                data-tour={tour}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
