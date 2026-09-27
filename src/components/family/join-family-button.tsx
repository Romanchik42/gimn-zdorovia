"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** Кнопка «Присоединиться» на странице приглашения (GIMN-030). */
export function JoinFamilyButton({ code, ownerName }: { code: string; ownerName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function join() {
    setPending(true);
    try {
      const res = await fetch("/api/family/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();

      if (!json.success) {
        toast.error(json.error ?? "Не удалось присоединиться");
        setPending(false);
        return;
      }

      toast.success(`Вы в семье: ${json.data.ownerName}`);
      router.push("/app/settings");
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
      setPending(false);
    }
  }

  return (
    <Button className="h-12 w-full" disabled={pending} onClick={() => void join()}>
      {pending ? <Loader2Icon className="size-5 animate-spin" aria-hidden /> : null}
      Присоединиться к семье ({ownerName})
    </Button>
  );
}
