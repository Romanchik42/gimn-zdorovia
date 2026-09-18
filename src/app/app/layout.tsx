import { BottomNav } from "@/components/layout/bottom-nav";

/**
 * Каркас приложения. ThemeProvider живёт в корневом layout (он нужен и
 * лендингу, и онбордингу), здесь добавляется только нижняя навигация.
 * SoundProvider и TourProvider подключаются на Этапе 8.
 */
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex flex-1 flex-col">{children}</div>
      <BottomNav />
    </div>
  );
}
