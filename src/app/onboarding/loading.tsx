import { Skeleton } from "@/components/ui/skeleton";

/** Мгновенный отклик между шагами онбординга (GIMN-perf), см. app/loading.tsx. */
export default function OnboardingLoading() {
  return (
    <div className="mx-auto w-full max-w-md flex-1 px-4 py-8" aria-hidden>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-1.5 h-4 w-3/4" />
      <div className="mt-8 space-y-3">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
      <Skeleton className="mt-8 h-12 w-full rounded-xl" />
    </div>
  );
}
