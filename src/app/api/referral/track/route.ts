import { z } from "zod";

import { fail, ok, parseBody, rateLimit } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidReferralCode, normalizeReferralCode } from "@/lib/referral/code-generator";
import { referralSourceSchema } from "@/lib/schemas/user";
import { firstName } from "@/lib/referral/format";

/**
 * POST /api/referral/track — фиксация перехода по приглашению (SPEC 3.4, 5.7).
 *
 * IP НЕ сохраняем (152-ФЗ, минимизация ПДн) — только user_agent, чтобы
 * отличать телефон от компьютера. Несуществующий код не ломает лендинг:
 * отвечаем успехом без записи.
 */

const trackSchema = z.object({
  code: z.string().min(1).max(20),
  source: referralSourceSchema.default("link"),
});

export async function POST(request: Request) {
  const parsed = await parseBody(request, trackSchema);
  if (parsed.error) return parsed.error;

  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 300);

  // SPEC 5.8: 10 запросов в минуту с одного user_agent — защита от перебора кодов.
  if (!rateLimit(`ref-track:${userAgent}`, 10, 60_000)) {
    return fail("Слишком много запросов", 429);
  }

  const code = normalizeReferralCode(parsed.data.code);
  if (!isValidReferralCode(code)) return ok({ tracked: false, inviter: null });

  const admin = createAdminClient();
  const { data: inviter } = await admin
    .from("users")
    .select("name")
    .eq("referral_code", code)
    .maybeSingle();

  if (!inviter) return ok({ tracked: false, inviter: null });

  const { error } = await admin
    .from("referral_clicks")
    .insert({ referral_code: code, source: parsed.data.source, user_agent: userAgent || null });

  if (error) console.error("referral click insert failed:", error.message);

  return ok({ tracked: !error, inviter: firstName(inviter.name) });
}
