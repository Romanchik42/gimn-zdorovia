import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Секреты не должны попадать в трассировку серверных бандлов ни при каких условиях.
  outputFileTracingExcludes: {
    "*": ["secrets/**", "**/*.env"],
  },

  // Шрифт для PDF (GIMN-029). Он читается с диска во время запроса, и без
  // этой строки файл не попадёт в serverless-функцию: трассировка видит
  // только то, что импортировано, а путь, собранный из строк, — не импорт.
  // В public/ шрифт класть нельзя: оттуда файлы раздаются через CDN, а на
  // диске функции их может не быть.
  outputFileTracingIncludes: {
    "/api/legal/[document]": ["assets/fonts/*.ttf"],
  },

  // GIF/картинки упражнений позже переедут в Supabase Storage.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },

  async headers() {
    return [
      {
        // Манифест и service worker не кешируем агрессивно —
        // иначе обновление PWA у пользователя залипает на старой версии.
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
