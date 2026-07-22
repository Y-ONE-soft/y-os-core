import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  forbidden,
  unauthorized,
} from "@/app/api/admin/guard";
import { reorderStages } from "@/server/workspace/service";

/**
 * 단계 순서 변경 — 프로젝트의 단계 전체를 새 순서대로 보낸다.
 * 부분 갱신이 아니라 전체 교체라 프로젝트 하위 리소스로 뒀다.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    stageIds?: unknown;
  } | null;
  if (
    !body ||
    !Array.isArray(body.stageIds) ||
    body.stageIds.length === 0 ||
    !body.stageIds.every((id) => typeof id === "string" && id.length > 0)
  ) {
    return badRequest();
  }

  const { projectId } = await params;
  const isMaster = user.role === "MASTER";

  // 색 변경·삭제와 동일한 범위 — 마스터는 전체, 스탭은 자기가 작업자인 프로젝트만
  const { count } = await reorderStages(
    projectId,
    body.stageIds as string[],
    isMaster ? undefined : { ownerId: user.id },
  );
  // 0건은 권한이 없거나, 보낸 목록이 서버의 단계 집합과 어긋난 경우
  if (count === 0) return forbidden();

  return NextResponse.json({ ok: true });
}
