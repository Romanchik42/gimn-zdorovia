import Link from "next/link";
import { ActivityIcon, HeartPulseIcon, ChevronRightIcon } from "lucide-react";

export const metadata = { title: "Режим — Гимн.здоровья" };

const MODES = [
  {
    href: "/onboarding/behtereva",
    icon: HeartPulseIcon,
    title: "Реабилитация Бехтерева",
    description:
      "Программа на подвижность позвоночника и суставов. Начнём с короткой диагностики.",
  },
  {
    href: "/onboarding/general",
    icon: ActivityIcon,
    title: "Общая форма",
    description: "Тренировки и меню под вашу цель: снизить вес, набрать массу или держать форму.",
  },
] as const;

export default function ModePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Что вам ближе?</h1>
        <p className="text-sm text-muted-foreground">
          Режим можно будет сменить в настройках.
        </p>
      </header>

      <div className="space-y-3">
        {MODES.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-4 rounded-xl bg-card p-5 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="flex-1 space-y-1">
              <span className="block font-medium">{title}</span>
              <span className="block text-sm text-muted-foreground">{description}</span>
            </span>
            <ChevronRightIcon className="mt-3 size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}
