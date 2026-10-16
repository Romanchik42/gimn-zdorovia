import { Skeleton } from "@/components/ui/skeleton";

/**
 * Мгновенный отклик при переходах по нижнему меню (GIMN-perf).
 * Один loading.tsx на уровне /app перехватывает навигацию ко всем вкладкам:
 * Next.js показывает этот каркас сразу по клику, пока сервер строит экран, —
 * поэтому нет «нажал → подвисло → дёрнулось». Каркас нейтральный (шапка +
 * несколько карточек), подходит под любой раздел.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-md flex-1 px-4 py-6" aria-hidden>
      {/* Шапка экрана */}
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-56" />

      {/* Карточки контента */}
      <div className="mt-6 space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}
