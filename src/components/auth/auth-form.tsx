"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from "@/lib/schemas/user";
import { clearReferralCode, readReferralCode } from "@/lib/referral/storage";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword(values);

      if (error) {
        toast.error("Не удалось войти. Проверьте почту и пароль.");
        return;
      }

      router.replace(params.get("next") ?? "/app");
      router.refresh();
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Почта</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Пароль</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" className="h-12 w-full" disabled={pending}>
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          Войти
        </Button>
      </form>
    </Form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(values: RegisterInput) {
    setPending(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, referral_code: readReferralCode() ?? undefined }),
      });
      const json = await res.json();

      if (!json.success) {
        toast.error(json.error ?? "Не удалось зарегистрироваться");
        return;
      }

      clearReferralCode();

      if (json.data.next_step === "confirm_email") {
        toast.success("Мы отправили письмо для подтверждения почты.");
        router.replace("/auth/login");
        return;
      }

      router.replace("/onboarding/welcome");
      router.refresh();
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Как вас зовут</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder="Роман" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Почта</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Пароль</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" className="h-12 w-full" disabled={pending}>
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          Создать аккаунт
        </Button>
      </form>
    </Form>
  );
}
