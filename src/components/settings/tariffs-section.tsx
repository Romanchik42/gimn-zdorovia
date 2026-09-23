import { CheckIcon, WalletIcon } from "lucide-react";

import { Section } from "@/components/settings/settings-sections";

/**
 * Тарифы (GIMN-027). Показываем цены, но кнопок оплаты нет намеренно:
 * приём платежей не подключён, а кнопка «Купить», которая никуда не ведёт,
 * хуже её отсутствия. Пока идёт тестовый период, это витрина — чтобы человек
 * заранее понимал, за что попросят деньги, и не встретил цену сюрпризом.
 */

type Tariff = {
  emoji: string;
  title: string;
  monthly: string;
  yearly: string;
  features: string[];
  highlight?: boolean;
};

const TARIFFS: Tariff[] = [
  {
    emoji: "🟢",
    title: "Базовый",
    monthly: "399 ₽",
    yearly: "3990 ₽ в год — экономия 17%",
    features: [
      "Все упражнения: Бехтерева и общий режим без турника",
      "Персональная программа на день",
      "Меню и БЖУ",
      "Напоминания",
      "Отслеживание прогресса",
    ],
  },
  {
    emoji: "🔵",
    title: "Плюс",
    monthly: "799 ₽",
    yearly: "7990 ₽ в год — экономия 17%",
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
    emoji: "🟣",
    title: "Семейный",
    monthly: "1490 ₽",
    yearly: "14 900 ₽ в год — экономия 17%",
    features: ["Всё из «Плюс»", "До 4 профилей в одном аккаунте", "Общий календарь и список покупок"],
  },
];

export function TariffsSection() {
  return (
    <Section icon={<WalletIcon className="size-4 text-primary" aria-hidden />} title="Тарифы и подписка">
      <div className="space-y-3">
        {TARIFFS.map((tariff) => (
          <TariffCard key={tariff.title} {...tariff} />
        ))}
      </div>

      <div className="space-y-1 rounded-lg border border-info-border bg-info p-4 text-sm text-info-foreground">
        <p className="font-medium">Пока идёт тестирование, пользование бесплатное.</p>
        <p>О запуске платного режима предупредим за 2 недели.</p>
        <p>Копите баллы за найденные баги и идеи — они пригодятся при оплате.</p>
      </div>
    </Section>
  );
}

function TariffCard({ emoji, title, monthly, yearly, features, highlight }: Tariff) {
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
          <span aria-hidden>{emoji}</span> {title}
        </h3>
        <p className="font-mono text-lg font-semibold">
          {monthly}
          <span className="text-sm font-normal text-muted-foreground">/мес</span>
        </p>
      </header>

      <p className="text-xs text-muted-foreground">{yearly}</p>

      <ul className="space-y-1">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2 text-sm">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
