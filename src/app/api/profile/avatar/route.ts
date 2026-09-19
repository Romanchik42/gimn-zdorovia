import { fail, ok } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Своё фото профиля (GIMN-011).
 * POST — загрузить (multipart, поле file), DELETE — убрать фото.
 *
 * Клиент уже ужимает картинку до 512×512 WebP, но сервер ему не верит:
 * тип определяем по сигнатуре файла, размер — не больше 5 МБ. Пишем в
 * бакет avatars сервисным ключом в папку пользователя; ссылка — users.avatar_url.
 */

const BUCKET = "avatars";
const MAX_BYTES = 5 * 1024 * 1024;

/** Тип по первым байтам — заголовку Content-Type от клиента не доверяем. */
function sniff(bytes: Uint8Array): { mime: string; ext: string } | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  const riff = String.fromCharCode(...b.slice(0, 4));
  const webp = String.fromCharCode(...b.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function removeOld(userId: string, keep?: string) {
  const storage = createAdminClient().storage.from(BUCKET);
  const { data: files } = await storage.list(userId, { limit: 100 });
  const stale = (files ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (stale.length) await storage.remove(stale);
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return fail("Нужно войти", 401);

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("file");
    file = value instanceof File ? value : null;
  } catch {
    return fail("Не удалось прочитать файл", 400);
  }
  if (!file) return fail("Выберите файл", 400);
  if (file.size > MAX_BYTES) return fail("Файл больше 5 МБ", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return fail("Подойдёт JPG, PNG или WebP", 415);

  const path = `${user.id}/${Date.now()}.${kind.ext}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: kind.mime, upsert: false, cacheControl: "31536000" });
  if (uploadError) {
    console.error("avatar upload failed:", uploadError.message);
    return fail("Не удалось загрузить фото", 500);
  }

  const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(path);
  const { error } = await admin.from("users").update({ avatar_url: publicUrl.publicUrl }).eq("id", user.id);
  if (error) {
    console.error("avatar_url save failed:", error.message);
    await admin.storage.from(BUCKET).remove([path]);
    return fail("Не удалось сохранить фото", 500);
  }

  await removeOld(user.id, path).catch((e) => console.error("old avatars cleanup failed:", e));
  return ok({ avatar_url: publicUrl.publicUrl });
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) return fail("Нужно войти", 401);

  const admin = createAdminClient();
  const { error } = await admin.from("users").update({ avatar_url: null }).eq("id", user.id);
  if (error) return fail("Не удалось убрать фото", 500);
  await removeOld(user.id).catch((e) => console.error("avatars cleanup failed:", e));
  return ok({ avatar_url: null });
}
