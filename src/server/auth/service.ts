import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { db } from "@/server/db";
import type { User } from "@/generated/prisma/client";
import type { SessionUser } from "@/types/auth";

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
  };
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
