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
 * username·role·groupId는 받지 않는다(권한·조직 구조라 본인이 바꿀 값이 아님).
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
