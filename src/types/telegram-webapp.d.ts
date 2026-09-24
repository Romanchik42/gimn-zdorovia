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
  /**
   * Где открыто приложение: ios, android, tdesktop, macos, web (GIMN-030).
   * Нужна, чтобы отличить мобильный Telegram, где скачивание файла не
   * работает, от настольного, где работает.
   */
  platform?: string;
};

interface Window {
  Telegram?: { WebApp?: TelegramWebApp };
}
