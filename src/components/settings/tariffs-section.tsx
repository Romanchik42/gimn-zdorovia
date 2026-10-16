import { CheckIcon, WalletIcon } from "lucide-react";

import { FamilyManagement } from "@/components/family/family-management";
import { TariffCheckout } from "@/components/settings/tariff-checkout";
import { Section } from "@/components/settings/settings-sections";
import type { PaymentTariff } from "@/lib/payments/provider";
import { TARIFF_PRICES, isTariff } from "@/lib/payments/rules";
import { isPaymentsEnabled } from "@/lib/payments/service";
import { createClient } from "@/lib/supabase/server";

/**
 * Тарифы (GIMN-027) и оплата через ЮKassa.
 *
 * Пока ключей ЮKassa в окружении нет, раздел остаётся витриной: цены видны,
 * кнопка оплаты неактивна с объяснением. Как только ключи появятся в Vercel,
 * кнопки оживают сами — отдельного выключателя нет и не нужно.
 *
 * Цены — из TARIFF_PRICES: по ним же сервер считает сумму платежа, и цифра
 * на витрине не может разойтись с цифрой в чеке.
 */

type Tariff = {
  tariff: PaymentTariff;
  emoji: string;
  yearlyNote: string;
  features: string[];
  highlight?: boolean;
};

const TARIFFS: Tariff[] = [
  {
    tariff: "basic",
    emoji: "🟢",
    yearlyNote: "в год — экономия 17%",
    features: [
      "Все упражнения: Бехтерева и общий режим без турника",
      "Персональная программа на день",
      "Меню и БЖУ",
      "Напоминания",
      "Отслеживание прогресса",
    ],
  },
  {
    tariff: "plus",
    emoji: "🔵",
    yearlyNote: "в год — экономия 17%",
    highlight: true,
    features: [
      "Всё из «Базового»",
      "Общий режим с турником и залом",
      "Конструктор своих тренировок",
      "Расширенное меню с рецептами",
      "Выгрузка для врача-ревматолога",
      "Живые видео упражнений",
      "Ответ поддержки в течение суток",
    ],
  },
  {
    tariff: "family",
    emoji: "🟣",
    yearlyNote: "в год — экономия 17%",
    features: ["Всё из «Плюс»", "До 4 профилей в одном аккаунте", "Общий календарь и список покупок"],
  },
];

type Subscription = { tariff: PaymentTariff; until: Date } | null;

/**
 * Действующая подписка. Отдельным запросом, а не в общем select страницы:
 * если миграция 0031 ещё не применена, колонок нет, и общий запрос профиля
 * упал бы вместе со всей страницей настроек. Здесь ошибка — просто «нет подписки».
 */
async function loadSubscription(): Promise<Subscription> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("users")
      .select("subscription_tariff, subscription_until")
      .eq("id", user.id)
      .maybeSingle();
    if (error || !data?.subscription_until || !isTariff(data.subscription_tariff)) return null;

    const until = new Date(data.subscription_until);
    return until.getTime() > Date.now() ? { tariff: data.subscription_tariff, until } : null;
  } catch {
    return null;
  }
}

export async function TariffsSection({
  appUrl,
  email,
  paymentReturn,
}: {
  appUrl: string;
  email: string | null;
  /** Человек вернулся со страницы оплаты ЮKassa. */
  paymentReturn?: boolean;
}) {
  const enabled = isPaymentsEnabled();
  const subscription = await loadSubscription();

  return (
    <Section icon={<WalletIcon className="size-4 text-primary" aria-hidden />} title="Тарифы и подписка">
      {subscription ? (
        <p className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
          Подписка «{TARIFF_PRICES[subscription.tariff].title}» оплачена до{" "}
          {subscription.until.toLocaleDateString("ru-RU")}
        </p>
      ) : null}

      {paymentReturn && !subscription ? (
        <p role="status" className="rounded-lg border border-info-border bg-info p-3 text-sm text-info-foreground">
          Спасибо! Платёж обрабатывается — подписка появится здесь в течение пары минут. Обновите
          страницу чуть позже.
        </p>
      ) : null}

      <div className="space-y-3">
        {TARIFFS.map((tariff) => (
          <TariffCard key={tariff.tariff} {...tariff} enabled={enabled} email={email ?? ""} />
        ))}
      </div>

      {/* Пока платного тарифа нет, приглашать может любой: механизм нужен
          уже сегодня, чтобы было что тестировать. Привязка к тарифу —
          следующим шагом, когда оплата заработает на проде. */}
      <FamilyManagement appUrl={appUrl} />

      {enabled ? (
        <div className="space-y-1 rounded-lg border border-info-border bg-info p-4 text-sm text-info-foreground">
          <p className="font-medium">Оплата картой через ЮKassa — чек придёт на почту.</p>
          <p>Баллы спишутся только после успешной оплаты.</p>
          <p>Продление прибавляется к оставшимся дням подписки.</p>
        </div>
      ) : (
        <div className="space-y-1 rounded-lg border border-info-border bg-info p-4 text-sm text-info-foreground">
          <p className="font-medium">Пока идёт тестирование, пользование бесплатное.</p>
          <p>О запуске платного режима предупредим за 2 недели.</p>
          <p>Копите баллы за найденные баги и идеи — они пригодятся при оплате.</p>
        </div>
      )}
    </Section>
  );
}

function TariffCard({
  tariff,
  emoji,
  yearlyNote,
  features,
  highlight,
  enabled,
  email,
}: Tariff & { enabled: boolean; email: string }) {
  const price = TARIFF_PRICES[tariff];

  return (
    <article
      className={
        highlight
          ? "space-y-2 rounded-xl bg-background p-4 ring-2 ring-primary"
          : "space-y-2 rounded-xl bg-background p-4 ring-1 ring-foreground/10"
      }
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-medium">
          <span aria-hidden>{emoji}</span> {price.title}
        </h3>
        <p className="font-mono text-lg font-semibold">
          {price.monthRub} ₽
          <span className="text-sm font-normal text-muted-foreground">/мес</span>
        </p>
      </header>

      <p className="text-xs text-muted-foreground">
        {price.yearRub.toLocaleString("ru-RU")} ₽ {yearlyNote}
      </p>

      <ul className="space-y-1">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2 text-sm">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <TariffCheckout tariff={tariff} title={price.title} enabled={enabled} defaultEmail={email} />
    </article>
  );
}
