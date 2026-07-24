import { NextResponse } from "next/server";

import { badRequest, currentUser, forbidden, unauthorized } from "@/app/api/admin/guard";
import { reorderTasks } from "@/server/workspace/service";

/**
 * 컨테이너(프로젝트·단계) 안에서 할일 순서 변경 — 새 순서대로 taskIds를 보낸다.
 * projectId·stageId는 null 가능(미배정/백로그). 부분 갱신이 아니라 순서 재배치라
 * 개별 할일이 아니라 컨테이너 단위의 하위 리소스로 뒀다.
 */
export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    projectId?: unknown;
    stageId?: unknown;
    taskIds?: unknown;
  } | null;
  const okId = (v: unknown) => v === null || typeof v === "string";
  if (
    !body ||
    !okId(body.projectId) ||
    !okId(body.stageId) ||
    !Array.isArray(body.taskIds) ||
    body.taskIds.length === 0 ||
    !body.taskIds.every((id) => typeof id === "string" && id.length > 0)
  ) {
    return badRequest();
  }

  const { count } = await reorderTasks(
    (body.projectId as string | null) ?? null,
    (body.stageId as string | null) ?? null,
    body.taskIds as string[],
  );
  // 0건은 보낸 목록이 그 컨테이너의 대상 집합과 어긋난 경우
  if (count === 0) return forbidden();

  return NextResponse.json({ ok: true });
}
