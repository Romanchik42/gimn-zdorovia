import { z } from "zod";

import { fail, ok, parseBody, rateLimit } from "@/lib/api";
import { TARIFF_PRICES } from "@/lib/payments/rules";
import { createCheckout } from "@/lib/payments/service";
import { createClient } from "@/lib/supabase/server";

const TARIFFS = Object.keys(TARIFF_PRICES) as [keyof typeof TARIFF_PRICES, ...(keyof typeof TARIFF_PRICES)[]];

const createSchema = z.object({
  tariff: z.enum(TARIFFS),
  period: z.enum(["month", "year"]),
  points: z.number().int().min(0).max(1_000_000).default(0),
  // Почту спрашиваем на оплате: на неё ЮKassa пришлёт чек.
  email: z.string().trim().email("Проверьте адрес почты").max(200),
});

/**
 * POST /api/payments/create — создать платёж и получить ссылку на оплату.
 *
 * Сумму клиент не присылает: сервер считает её сам по тарифу, периоду и
 * баллам — иначе цену можно было бы подставить в запрос.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, createSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  // Защита от дребезга кнопки: каждый вызов создаёт платёж в ЮKassa.
  if (!rateLimit(`payment-create:${user.id}`, 5, 60_000)) {
    return fail("Слишком много попыток. Подождите минуту.", 429);
  }

  const result = await createCheckout({ userId: user.id, ...parsed.data });
  if (!result.ok) return fail(result.error, result.status);

  return ok({ confirmationUrl: result.confirmationUrl });
}
