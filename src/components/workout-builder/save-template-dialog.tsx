"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_CUSTOM_TEMPLATES } from "@/lib/schemas/workout";

/** Диалог «Сохранить как шаблон» (SPEC 3.2). */
export function SaveTemplateDialog({
  open,
  onOpenChange,
  defaultName,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  onSave: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState(defaultName);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setPending(true);
    const saved = await onSave(trimmed);
    setPending(false);
    if (saved) onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setName(defaultName);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-sm">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Сохранить как шаблон</DialogTitle>
            <DialogDescription>
              Шаблон появится на главном экране и запустится в одно касание. Можно хранить до{" "}
              {MAX_CUSTOM_TEMPLATES} шаблонов.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="template-name">Название</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="h-12"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button type="submit" className="h-12 w-full" disabled={pending || !name.trim()}>
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              Сохранить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
