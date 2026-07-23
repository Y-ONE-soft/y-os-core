import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/constants";
import { db } from "@/server/db";
import {
  EmailTakenError,
  getSessionUser,
  updateProfile,
} from "@/server/auth/service";
import type { ProfilePatch } from "@/types/auth";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const user = token ? await getSessionUser(token) : null;

  if (!user) {
    if (token) cookieStore.delete(SESSION_COOKIE);
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  return NextResponse.json({ user });
}

/** 본인이 바꿀 수 있는 필드만 — username·role·groupId는 의도적으로 빠져 있다 */
const EDITABLE = ["name", "title", "email", "phone"] as const;

/** 비우면 null로 저장한다(직책·이메일·연락처는 선택 항목). 이름만 필수. */
function normalize(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  // 수정 대상을 요청이 아니라 세션에서 정한다 — id를 아예 받지 않으므로
  // 남의 계정을 가리키는 우회가 성립하지 않는다.
  const current = token ? await getSessionUser(token) : null;
  if (!current) {
    if (token) cookieStore.delete(SESSION_COOKIE);
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const patch: ProfilePatch = {};
  for (const key of EDITABLE) {
    if (!(key in body)) continue;
    if (key === "name") {
      const name = normalize(body.name);
      if (!name) {
        return NextResponse.json(
          { error: "이름을 입력하세요." },
          { status: 400 },
        );
      }
      patch.name = name;
    } else {
      patch[key] = normalize(body[key]);
    }
  }

  // 소속 그룹은 마스터만 바꿀 수 있다. 스탭이 보내면 조용히 무시한다.
  // 빈 값(소속 없음)은 허용하지 않고, 실제 존재하는 그룹만 받는다(FK 위반 500 방지).
  if ("groupId" in body && current.role === "MASTER") {
    const groupId = body.groupId;
    if (typeof groupId !== "string" || !groupId.trim()) {
      return NextResponse.json(
        { error: "소속 그룹을 선택하세요." },
        { status: 400 },
      );
    }
    const group = await db.projectGroup.findUnique({
      where: { id: groupId },
      select: { id: true },
    });
    if (!group) {
      return NextResponse.json(
        { error: "존재하지 않는 그룹입니다." },
        { status: 400 },
      );
    }
    patch.groupId = groupId;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const user = await updateProfile(current.id, patch);
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
