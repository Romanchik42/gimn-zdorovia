/**
 * Минимальный тип Telegram Web App (telegram-web-app.js) — только то, чем
 * пользуемся. Вне Telegram window.Telegram нет или initData пустой.
 */
type TelegramWebApp = {
  initData: string;
  ready(): void;
  expand(): void;
  /**
   * Полноэкранный режим на мобильных (Bot API 8.0+). Может отсутствовать в
   * старых клиентах и на десктопе — вызывать только при проверке typeof.
   */
  requestFullscreen?(): void;
  /**
   * Запрет вертикального свайпа, который сворачивает/закрывает Web App
   * (Bot API 7.7+). Чтобы случайный свайп не выбрасывал из приложения.
   */
  disableVerticalSwipes?(): void;
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
