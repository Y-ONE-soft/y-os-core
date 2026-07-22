import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  isName,
  unauthorized,
} from "@/app/api/admin/guard";
import { createProject } from "@/server/workspace/service";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    groupId?: unknown;
    name?: unknown;
    color?: unknown;
  } | null;
  if (!body || !isName(body.id) || !isName(body.name) || !isName(body.color)) {
    return badRequest();
  }

  // 소속 그룹 결정 — 스탭은 클라이언트가 보낸 groupId를 신뢰하지 않고 세션
  // 사용자의 소속 그룹으로 강제한다 (남의 그룹에 생성하는 우회 차단).
  // 마스터는 전체 그룹을 다루므로 요청 값을 그대로 쓴다.
  let groupId: string;
  if (user.role === "MASTER") {
    if (!isName(body.groupId)) return badRequest();
    groupId = body.groupId;
  } else {
    if (!user.groupId) {
      return badRequest("소속 그룹이 없어 프로젝트를 만들 수 없습니다.");
    }
    groupId = user.groupId;
  }

  await createProject({
    id: body.id,
    groupId,
    name: body.name.trim(),
    color: body.color,
    ownerId: user.id, // 작업자 = 만든 사람
  });
  return NextResponse.json({ ok: true });
}
