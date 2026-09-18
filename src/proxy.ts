import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";

/**
 * Обновляет сессию Supabase на каждом запросе и закрывает приватные разделы.
 * Проверка здесь — только «залогинен или нет». Право доступа к данным режет
 * RLS в БД, а права админа проверяются в самом Server Component (SPEC 5.8).
 */

const PROTECTED_PREFIXES = ["/app", "/onboarding", "/admin"];
const GUEST_ONLY = ["/auth/login", "/auth/register"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Без конфигурации Supabase не трогаем запрос вообще — иначе вся страница ляжет в 500.
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && GUEST_ONLY.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Всё, кроме статики и картинок: proxy должен обновлять токен
     * на обычных навигациях, но не тратиться на ассеты.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|marketing/|sounds/|manifest.json|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|webp|mp3|ico)$).*)",
  ],
};
