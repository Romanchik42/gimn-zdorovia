import { integrationsEnv } from "@/lib/env";

/**
 * Вход через Google, Apple и VK (GIMN-029) — пока только подготовка.
 *
 * Полной реализации здесь нет намеренно. Каждый из трёх требует
 * зарегистрированного приложения на стороне провайдера: Google Cloud
 * Console, Apple Developer, VK ID. Регистрация делается живым человеком со
 * своими документами и своим аккаунтом, и написать её в коде нельзя.
 *
 * Что здесь есть: одно место, где перечислены провайдеры, и честный ответ
 * на вопрос «подключён ли». Когда ключи появятся в Vercel, кнопки оживут
 * без правок интерфейса — он спрашивает у этого модуля, а не у себя.
 */

export const OAUTH_PROVIDERS = ["google", "apple", "vk"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const OAUTH_LABELS: Record<OAuthProvider, string> = {
  google: "Google",
  apple: "Apple",
  vk: "VK ID",
};

export function isOAuthConfigured(provider: OAuthProvider): boolean {
  const env = integrationsEnv();
  switch (provider) {
    case "google":
      return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
    case "apple":
      return Boolean(env.APPLE_CLIENT_ID);
    case "vk":
      return Boolean(env.VK_APP_ID && env.VK_APP_SECRET);
  }
}

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}
