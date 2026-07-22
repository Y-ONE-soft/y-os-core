import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  isName,
  unauthorized,
} from "@/app/api/admin/guard";
import { createTask } from "@/server/workspace/service";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    projectId?: unknown;
    stageId?: unknown;
    name?: unknown;
    assigneeId?: unknown;
  } | null;
  if (!body || !isName(body.id) || !isName(body.name)) return badRequest();

  await createTask({
    id: body.id,
    // projectId 미지정(null)은 미배정 할일 — 내 할일에서 만든 직후 상태
    projectId: isName(body.projectId) ? body.projectId : null,
    stageId: isName(body.stageId) ? body.stageId : null,
    name: body.name.trim(),
    // 키를 아예 안 보내면 기본값 규칙(프로젝트 소유자 → 만든 사람)에 맡기고,
    // null을 명시해 보내면 미배정을 뜻한다 — 둘을 구분해야 한다
    assigneeId:
      body.assigneeId === undefined
        ? undefined
        : isName(body.assigneeId)
          ? body.assigneeId
          : null,
    createdById: user.id,
  });
  return NextResponse.json({ ok: true });
}
