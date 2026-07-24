import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  forbidden,
  unauthorized,
} from "@/app/api/admin/guard";
import { reorderProjects } from "@/server/workspace/service";

/**
 * 사이드바 프로젝트 순서 변경 — 그룹 안에서 새 순서대로 projectIds를 보낸다.
 * 마스터는 그룹 전체를, 스탭은 자기 소유 프로젝트만 재정렬한다(서버가 재검증).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    projectIds?: unknown;
  } | null;
  if (
    !body ||
    !Array.isArray(body.projectIds) ||
    body.projectIds.length === 0 ||
    !body.projectIds.every((id) => typeof id === "string" && id.length > 0)
  ) {
    return badRequest();
  }

  const { groupId } = await params;
  const isMaster = user.role === "MASTER";

  const { count } = await reorderProjects(
    groupId,
    body.projectIds as string[],
    isMaster ? undefined : { ownerId: user.id },
  );
  // 0건은 권한이 없거나, 보낸 목록이 서버의 대상 집합과 어긋난 경우
  if (count === 0) return forbidden();

  return NextResponse.json({ ok: true });
}
