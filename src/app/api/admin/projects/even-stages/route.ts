import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  isISODate,
  isName,
  resolveProjectGroupId,
  unauthorized,
} from "@/app/api/admin/guard";
import { createProjectWithEvenStages } from "@/server/workspace/compose";
import { evenSplitError } from "@/lib/stage-plan";

/** 기간을 균등 분할한 단계로 프로젝트를 만든다 (직접 만들기) */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    groupId?: unknown;
    name?: unknown;
    color?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    stageCount?: unknown;
  } | null;

  if (
    !body ||
    !isName(body.id) ||
    !isName(body.name) ||
    !isName(body.color) ||
    !isISODate(body.startDate) ||
    !isISODate(body.endDate) ||
    typeof body.stageCount !== "number"
  ) {
    return badRequest();
  }

  // 화면과 같은 기준으로 검증해 안내 문구가 어긋나지 않게 한다
  const invalid = evenSplitError(body.startDate, body.endDate, body.stageCount);
  if (invalid) return badRequest(invalid);

  const groupId = resolveProjectGroupId(user, body.groupId);
  if (typeof groupId !== "string") return groupId;

  await createProjectWithEvenStages({
    projectId: body.id,
    groupId,
    name: body.name.trim(),
    color: body.color,
    ownerId: user.id,
    startDate: body.startDate,
    endDate: body.endDate,
    stageCount: body.stageCount,
  });

  return NextResponse.json({ ok: true });
}
