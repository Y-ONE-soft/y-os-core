import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  forbidden,
  unauthorized,
} from "@/app/api/admin/guard";
import {
  deleteStage,
  updateStage,
  type StagePatch,
} from "@/server/workspace/service";

const PATCHABLE = [
  "name",
  "description",
  "done",
  "startDate",
  "endDate",
  "showDeadline",
  "requestedCollaborators",
] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ stageId: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return badRequest();

  const patch: Record<string, unknown> = {};
  for (const key of PATCHABLE) if (key in body) patch[key] = body[key];
  if (Object.keys(patch).length === 0) return badRequest();

  const { stageId } = await params;
  await updateStage(stageId, patch as StagePatch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ stageId: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { stageId } = await params;
  const isMaster = user.role === "MASTER";

  // 마스터는 전체 단계를, 스탭은 자기가 작업자인 프로젝트의 단계만 지운다
  // (프로젝트 삭제 가드와 동일 — projects/[projectId]/route.ts)
  const { count } = await deleteStage(
    stageId,
    isMaster ? undefined : { ownerId: user.id },
  );

  // 스탭이 0건이면 남의 단계이거나 이미 없는 것 — 존재 여부를 흘리지 않도록
  // 구분 없이 403. 마스터는 멱등하게 ok (없는 id 삭제도 성공 취급).
  if (!isMaster && count === 0) return forbidden();

  return NextResponse.json({ ok: true });
}
