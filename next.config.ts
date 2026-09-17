import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Секреты не должны попадать в трассировку серверных бандлов ни при каких условиях.
  outputFileTracingExcludes: {
    "*": ["secrets/**", "**/*.env"],
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
