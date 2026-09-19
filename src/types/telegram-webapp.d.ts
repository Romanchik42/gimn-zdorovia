/**
 * Минимальный тип Telegram Web App (telegram-web-app.js) — только то, чем
 * пользуемся. Вне Telegram window.Telegram нет или initData пустой.
 */
type TelegramWebApp = {
  initData: string;
  ready(): void;
  expand(): void;
  /** Открыть t.me-ссылку внутри Telegram (например, выбор чата для отправки). */
  openTelegramLink?(url: string): void;
};

interface Window {
  Telegram?: { WebApp?: TelegramWebApp };
}
