import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/constants";
import {
  PASSWORD_MIN_LENGTH,
  WrongPasswordError,
  changePassword,
  getSessionUser,
} from "@/server/auth/service";

/**
 * 비밀번호 변경 — /api/auth/me(프로필 수정)와 분리했다.
 * 검증 규칙도 실패 사유도 달라 한 핸들러에 섞으면 분기가 지저분해진다.
 */
export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  // 대상은 세션에서 정한다 — userId를 받지 않으므로 남의 비밀번호를
  // 가리키는 우회가 성립하지 않는다.
  const current = token ? await getSessionUser(token) : null;
  if (!current || !token) {
    if (token) cookieStore.delete(SESSION_COOKIE);
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    currentPassword?: unknown;
    nextPassword?: unknown;
  } | null;
  const currentPassword = body?.currentPassword;
  const nextPassword = body?.nextPassword;
  if (typeof currentPassword !== "string" || typeof nextPassword !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (nextPassword.length < PASSWORD_MIN_LENGTH) {
    return NextResponse.json(
      { error: `새 비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.` },
      { status: 400 },
    );
  }
  if (nextPassword === currentPassword) {
    return NextResponse.json(
      { error: "현재 비밀번호와 다른 비밀번호를 입력하세요." },
      { status: 400 },
    );
  }

  try {
    await changePassword(current.id, currentPassword, nextPassword, token);
  } catch (error) {
    if (error instanceof WrongPasswordError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
