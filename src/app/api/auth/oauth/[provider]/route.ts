import { fail } from "@/lib/api";
import { isOAuthConfigured, isOAuthProvider, OAUTH_LABELS } from "@/lib/auth/oauth";

/**
 * GET /api/auth/oauth/<провайдер> — вход через Google, Apple или VK.
 *
 * Пока это заглушка, и она отвечает честно: 503 и текст о том, что канал
 * не подключён. Молчаливый редирект в никуда или страница «скоро» под
 * видом входа были бы хуже — человек решил бы, что сломалось приложение.
 *
 * Когда ключи появятся, здесь встанет редирект к провайдеру; интерфейс
 * трогать не придётся — он спрашивает про готовность отдельно.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/auth/oauth/[provider]">) {
  const { provider } = await params;

  if (!isOAuthProvider(provider)) return fail("Неизвестный способ входа", 404);

  if (!isOAuthConfigured(provider)) {
    return fail(`Вход через ${OAUTH_LABELS[provider]} пока не подключён. Войдите через Telegram.`, 503);
  }

  return fail("Вход через этого провайдера ещё не реализован", 501);
}
