import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { db } from "@/server/db";
import { Prisma } from "@/generated/prisma/client";
import type { User } from "@/generated/prisma/client";
import type { ProfilePatch, SessionUser } from "@/types/auth";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일 고정 만료

function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    groupId: user.groupId,
    title: user.title,
    email: user.email,
    phone: user.phone,
  };
}

/** 이메일이 이미 다른 계정에 쓰이고 있을 때 — 라우트가 409로 변환한다 */
export class EmailTakenError extends Error {
  constructor() {
    super("이미 사용 중인 이메일입니다.");
    this.name = "EmailTakenError";
  }
}

/**
 * 본인 프로필 수정 — 대상은 호출자가 넘긴 userId로 고정된다.
 * username·role은 받지 않는다(권한·조직 구조라 본인이 바꿀 값이 아님).
 * groupId는 patch에 있으면 반영하지만, 마스터만 넣도록 라우트에서 미리 거른다.
 */
export async function updateProfile(
  userId: string,
  patch: ProfilePatch,
): Promise<SessionUser | null> {
  // 이메일은 @unique — 먼저 확인해 Prisma 제약 위반(500) 대신 의미 있는 에러를 낸다.
  // 경합으로 빠져나가는 경우는 아래 catch가 받는다.
  if (patch.email) {
    const taken = await db.user.findFirst({
      where: { email: patch.email, id: { not: userId } },
      select: { id: true },
    });
    if (taken) throw new EmailTakenError();
  }

  try {
    const updated = await db.user.update({ where: { id: userId }, data: patch });
    return toSessionUser(updated);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new EmailTakenError();
    }
    throw error;
  }
}

/** 아이디 또는 이메일 + 비밀번호 검증 후 세션을 발급한다. 실패 시 null. */
export async function login(
  identifier: string,
  password: string,
): Promise<{ token: string; expiresAt: Date; user: SessionUser } | null> {
  const user = await db.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
  });
  if (!user) return null;

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) return null;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { id: token, userId: user.id, expiresAt } });

  return { token, expiresAt, user: toSessionUser(user) };
}

export async function logout(token: string): Promise<void> {
  await db.session.deleteMany({ where: { id: token } });
}

/**
 * 비밀번호 최소 길이. 시드 계정이 4자(`1111`)라 우선 4로 둔다.
 * 운영 전에는 반드시 올려야 한다 — docs 참고.
 */
export const PASSWORD_MIN_LENGTH = 4;

/** 현재 비밀번호가 틀렸을 때 — 라우트가 400으로 변환한다 */
export class WrongPasswordError extends Error {
  constructor() {
    super("현재 비밀번호가 올바르지 않습니다.");
    this.name = "WrongPasswordError";
  }
}

/**
 * 비밀번호 변경.
 *
 * 현재 비밀번호를 반드시 확인한다 — 세션이 탈취된 상황에서 공격자가 비밀번호를
 * 바꿔 계정을 통째로 가져가는 것을 막는 최소 방어다.
 *
 * 성공하면 **지금 쓰는 세션만 남기고 나머지를 지운다.** 비밀번호를 바꾸는 이유
 * 자체가 "다른 데서 누가 내 계정을 쓰고 있다"인 경우가 있어, 바꿔도 기존 세션이
 * 살아 있으면 목적을 달성하지 못한다.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  nextPassword: string,
  keepToken: string,
): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new WrongPasswordError();

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) throw new WrongPasswordError();

  const passwordHash = await bcrypt.hash(nextPassword, 10);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash } }),
    db.session.deleteMany({ where: { userId, id: { not: keepToken } } }),
  ]);
}

/** 세션 토큰을 검증해 사용자 정보를 돌려준다. 만료된 세션은 즉시 정리한다. */
export async function getSessionUser(
  token: string,
): Promise<SessionUser | null> {
  const session = await db.session.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.deleteMany({ where: { id: token } });
    return null;
  }

  return toSessionUser(session.user);
}
