import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { PwaRegistrar } from "@/components/layout/pwa-registrar";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { appearanceBootstrapScript } from "@/lib/appearance";
import { DEFAULT_THEME } from "@/lib/themes";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["cyrillic", "latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["cyrillic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://gimn-zdorovia.vercel.app",
  ),
  title: "Гимн.здоровья — гимнастика для здоровья",
  description:
    "Гимнастика для здоровья при болезни Бехтерева и для поддержания формы. Персональная программа, меню питания, адаптация под твой прогресс.",
  openGraph: {
    title: "Гимн.здоровья — гимнастика для здоровья",
    description:
      "Ежедневная гимнастика при болезни Бехтерева и для формы. 30 минут в день.",
    type: "website",
    locale: "ru_RU",
    images: ["/marketing/og-image.png"],
  },
  manifest: "/manifest.json",
  // Ярлык на домашнем экране iPhone (scripts/generate-icons.mjs).
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#7C9885",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      data-theme={DEFAULT_THEME}
      data-info-tint="neutral"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* до первой отрисовки поднимаем сохранённую тему — иначе мигает дефолтом */}
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrapScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster theme="light" richColors position="top-center" />
        <PwaRegistrar />
      </body>
    </html>
  );
}
