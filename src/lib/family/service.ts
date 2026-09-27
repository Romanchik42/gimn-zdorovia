import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  FAMILY_MAX_MEMBERS,
  INVITE_STATE_MESSAGES,
  canInvite,
  generateInviteCode,
  inviteExpiresAt,
  inviteState,
  isValidInviteCode,
  joinRefusal,
} from "@/lib/family/rules";

/**
 * Семейный тариф: приглашения и состав (GIMN-030).
 *
 * Пишет только служебный ключ. У таблиц есть политика на чтение своих
 * строк и нет ни одной на запись — иначе подставить себя в чужую семью
 * можно было бы прямо из браузера, минуя и срок приглашения, и потолок.
 *
 * Пока платного тарифа нет, приглашать может любой. Проверка «у вас
 * оплачен Семейный» появится вместе с оплатой — сейчас ей неоткуда
 * взяться, а механизм нужен уже сегодня, чтобы было что тестировать.
 */

export type FamilyMember = {
  id: string;
  userId: string;
  name: string;
  /** Дата присоединения, ISO. Null — приглашение ещё не принято. */
  acceptedAt: string | null;
};

export type FamilyInvite = {
  code: string;
  expiresAt: string;
};

export type FamilyState = {
  /** Глава семьи, если человек в чьей-то семье состоит. */
  ownerName: string | null;
  /** Он сам — глава. */
  isOwner: boolean;
  members: FamilyMember[];
  invite: FamilyInvite | null;
  canInviteMore: boolean;
};

/** Сколько человек уже в семье этого владельца. */
async function memberCount(admin: ReturnType<typeof createAdminClient>, ownerId: string): Promise<number> {
  const { count } = await admin
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  return count ?? 0;
}

/**
 * Состав семьи глазами этого человека. Один ответ и владельцу, и
 * приглашённому: экран у них общий, а разницу показывает isOwner.
 */
export async function familyState(userId: string): Promise<FamilyState> {
  const admin = createAdminClient();

  // Состоит ли он у кого-то в семье. Строка максимум одна — уникальный
  // индекс по member_id.
  const { data: membership } = await admin
    .from("family_members")
    .select("owner_id")
    .eq("member_id", userId)
    .maybeSingle();

  if (membership) {
    const { data: owner } = await admin
      .from("users")
      .select("name")
      .eq("id", membership.owner_id)
      .maybeSingle();
    return {
      ownerName: owner?.name ?? "Владелец",
      isOwner: false,
      members: [],
      invite: null,
      canInviteMore: false,
    };
  }

  const { data: rows } = await admin
    .from("family_members")
    .select("id, member_id, accepted_at")
    .eq("owner_id", userId)
    .order("invited_at", { ascending: true });

  const members: FamilyMember[] = [];
  if (rows?.length) {
    const { data: people } = await admin
      .from("users")
      .select("id, name")
      .in("id", rows.map((r) => r.member_id));
    const byId = new Map((people ?? []).map((p) => [p.id, p.name]));
    for (const row of rows) {
      members.push({
        id: row.id,
        userId: row.member_id,
        name: byId.get(row.member_id) ?? "Участник",
        acceptedAt: row.accepted_at,
      });
    }
  }

  const { data: invites } = await admin
    .from("family_invites")
    .select("invite_code, expires_at, used_by")
    .eq("owner_id", userId)
    .is("used_by", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const fresh = (invites ?? []).find(
    (i) => inviteState({ expiresAt: i.expires_at, usedBy: i.used_by }) === "active",
  );

  return {
    ownerName: null,
    isOwner: true,
    members,
    invite: fresh ? { code: fresh.invite_code, expiresAt: fresh.expires_at } : null,
    canInviteMore: canInvite(members.length),
  };
}

export type InviteResult = { ok: true; invite: FamilyInvite } | { ok: false; error: string };

/**
 * Создать ссылку. Прежние неиспользованные удаляем: активная ссылка одна,
 * иначе человек копирует одну, присылает другую и не понимает, почему
 * «уже присоединились».
 */
export async function createInvite(ownerId: string): Promise<InviteResult> {
  const admin = createAdminClient();

  const { data: membership } = await admin
    .from("family_members")
    .select("id")
    .eq("member_id", ownerId)
    .maybeSingle();
  if (membership) {
    return { ok: false, error: "Вы состоите в чужой семье — приглашать может только её глава." };
  }

  const count = await memberCount(admin, ownerId);
  if (!canInvite(count)) {
    return { ok: false, error: `Больше ${FAMILY_MAX_MEMBERS} человек пригласить нельзя.` };
  }

  await admin.from("family_invites").delete().eq("owner_id", ownerId).is("used_by", null);

  const invite = { code: generateInviteCode(), expiresAt: inviteExpiresAt() };
  const { error } = await admin.from("family_invites").insert({
    owner_id: ownerId,
    invite_code: invite.code,
    expires_at: invite.expiresAt,
  });

  if (error) {
    console.error("family invite insert failed:", error.message);
    return { ok: false, error: "Не удалось создать ссылку. Попробуйте ещё раз." };
  }

  return { ok: true, invite };
}

/** Убрать активную ссылку, не дожидаясь срока. */
export async function revokeInvite(ownerId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("family_invites").delete().eq("owner_id", ownerId).is("used_by", null);
}

export type InvitePreview =
  | { ok: true; ownerName: string; code: string }
  | { ok: false; error: string };

/** Что показать на странице приглашения до входа: кто зовёт и жива ли ссылка. */
export async function previewInvite(code: string): Promise<InvitePreview> {
  if (!isValidInviteCode(code)) return { ok: false, error: "Ссылка не похожа на приглашение." };

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("family_invites")
    .select("owner_id, expires_at, used_by")
    .eq("invite_code", code)
    .maybeSingle();

  if (!invite) return { ok: false, error: "Такого приглашения нет." };

  const state = inviteState({ expiresAt: invite.expires_at, usedBy: invite.used_by });
  if (state !== "active") return { ok: false, error: INVITE_STATE_MESSAGES[state] };

  const { data: owner } = await admin.from("users").select("name").eq("id", invite.owner_id).maybeSingle();
  return { ok: true, ownerName: owner?.name ?? "Владелец", code };
}

export type JoinResult = { ok: true; ownerName: string } | { ok: false; error: string };

/**
 * Принять приглашение.
 *
 * Потолок проверяется здесь, а не только в момент выдачи ссылки: между
 * созданием и переходом по ней владелец мог позвать ещё двоих другими
 * ссылками, и семья бы переполнилась.
 */
export async function joinFamily(code: string, joinerId: string): Promise<JoinResult> {
  if (!isValidInviteCode(code)) return { ok: false, error: "Ссылка не похожа на приглашение." };

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("family_invites")
    .select("id, owner_id, expires_at, used_by")
    .eq("invite_code", code)
    .maybeSingle();

  if (!invite) return { ok: false, error: "Такого приглашения нет." };

  const state = inviteState({ expiresAt: invite.expires_at, usedBy: invite.used_by });
  if (state !== "active") return { ok: false, error: INVITE_STATE_MESSAGES[state] };

  const { data: existing } = await admin
    .from("family_members")
    .select("id")
    .eq("member_id", joinerId)
    .maybeSingle();

  const refusal = joinRefusal({
    ownerId: invite.owner_id,
    joinerId,
    memberCount: await memberCount(admin, invite.owner_id),
    joinerHasFamily: Boolean(existing),
  });
  if (refusal) return { ok: false, error: refusal };

  const now = new Date().toISOString();
  const { error } = await admin.from("family_members").insert({
    owner_id: invite.owner_id,
    member_id: joinerId,
    accepted_at: now,
  });

  if (error) {
    console.error("family join failed:", error.message);
    return { ok: false, error: "Не удалось присоединиться. Попробуйте ещё раз." };
  }

  // Ссылку гасим после вступления, а не до: сорвавшаяся вставка оставила
  // бы человека без семьи и без ссылки.
  await admin.from("family_invites").update({ used_by: joinerId, used_at: now }).eq("id", invite.id);

  const { data: owner } = await admin.from("users").select("name").eq("id", invite.owner_id).maybeSingle();
  return { ok: true, ownerName: owner?.name ?? "Владелец" };
}

/**
 * Убрать человека из семьи. Может владелец — кого угодно из своих, и сам
 * участник — себя. Данные не трогаем вообще: прогресс, замеры и план
 * остаются у обоих. Расставание по оплате — не повод стирать чью-то
 * историю занятий.
 */
export async function removeMember(rowId: string, actorId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("family_members")
    .select("id, owner_id, member_id")
    .eq("id", rowId)
    .maybeSingle();

  if (!row) return { ok: false, error: "Участник не найден" };
  if (row.owner_id !== actorId && row.member_id !== actorId) {
    return { ok: false, error: "Не найдено" };
  }

  const { error } = await admin.from("family_members").delete().eq("id", rowId);
  if (error) {
    console.error("family remove failed:", error.message);
    return { ok: false, error: "Не удалось удалить участника" };
  }
  return { ok: true };
}
