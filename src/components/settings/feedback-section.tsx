"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2Icon, MessageSquareIcon, SendIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Section } from "@/components/settings/settings-sections";
import {
  FEEDBACK_PLACEHOLDERS,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABELS,
  feedbackSchema,
} from "@/lib/schemas/feedback";
import { cn } from "cn";

type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/** «Отзыв / Сообщить об ошибке / Предложение» (GIMN-011): в БД и в Telegram автору. */
export function FeedbackSection() {
  const [type, setType] = useState<FeedbackType>("review");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  const valid = feedbackSchema.safeParse({ type, text }).success;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || pending) return;
    setPending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, text: text.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Не удалось отправить");
        return;
      }
      setText("");
      toast.success("Спасибо, отзыв отправлен");
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Section icon={<MessageSquareIcon className="size-4 text-primary" aria-hidden />} title="Отзыв и предложения">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Тип сообщения">
          {FEEDBACK_TYPES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              onClick={() => setType(value)}
              className={cn(
                "min-h-11 rounded-lg border px-2 text-sm font-medium transition-colors",
                type === value ? "border-primary bg-primary/8" : "border-border hover:bg-muted",
              )}
            >
              {FEEDBACK_TYPE_LABELS[value]}
            </button>
          ))}
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={FEEDBACK_PLACEHOLDERS[type]}
          maxLength={2000}
          rows={4}
          aria-label="Текст сообщения"
        />

        <Button type="submit" className="h-11 w-full" disabled={!valid || pending}>
          {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <SendIcon className="size-4" aria-hidden />}
          Отправить
        </Button>
        <p className="text-xs text-muted-foreground">
          Сообщение уходит автору приложения. Ответ придёт в Telegram, если он у вас привязан.
        </p>
      </form>
    </Section>
  );
}
