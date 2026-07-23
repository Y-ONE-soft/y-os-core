import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  isISODate,
  isName,
  resolveProjectGroupId,
  unauthorized,
} from "@/app/api/admin/guard";
import { createProjectWithStages } from "@/server/workspace/compose";
import { stageSpansError, type StageSpan } from "@/lib/stage-plan";

/** 단계 날짜 구간 배열로 프로젝트를 만든다 (직접 만들기). 구간은 겹쳐도 된다. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    groupId?: unknown;
    name?: unknown;
    color?: unknown;
    spans?: unknown;
  } | null;

  if (
    !body ||
    !isName(body.id) ||
    !isName(body.name) ||
    !isName(body.color) ||
    !Array.isArray(body.spans)
  ) {
    return badRequest();
  }

  // 각 구간이 { startDate, endDate } 형태인지 먼저 걸러 낸 뒤 공통 검증에 넘긴다.
  const spans: StageSpan[] = [];
  for (const raw of body.spans) {
    if (
      typeof raw !== "object" ||
      raw === null ||
      !isISODate((raw as { startDate?: unknown }).startDate) ||
      !isISODate((raw as { endDate?: unknown }).endDate)
    ) {
      return badRequest();
    }
    const span = raw as StageSpan;
    spans.push({ startDate: span.startDate, endDate: span.endDate });
  }

  // 화면과 같은 기준으로 검증한다 (개수 상한·각 구간 start ≤ end). 겹침은 허용.
  const invalid = stageSpansError(spans);
  if (invalid) return badRequest(invalid);

  const groupId = resolveProjectGroupId(user, body.groupId);
  if (typeof groupId !== "string") return groupId;

  await createProjectWithStages({
    projectId: body.id,
    groupId,
    name: body.name.trim(),
    color: body.color,
    ownerId: user.id,
    spans,
  });

  return NextResponse.json({ ok: true });
}
