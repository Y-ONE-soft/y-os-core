import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  isName,
  unauthorized,
} from "@/app/api/admin/guard";
import {
  createRequests,
  listRequestsForUser,
} from "@/server/requests/service";

/** 내가 보냈거나 받은 요청 목록 */
export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();

  const requests = await listRequestsForUser(user.id);
  return NextResponse.json({ requests });
}

const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every(isName);

/** 요청 발송 — 여러 명에게 보내면 사람별 1건씩 만들어진다 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    ids?: unknown;
    kind?: unknown;
    toUserIds?: unknown;
    message?: unknown;
    taskId?: unknown;
    stageId?: unknown;
  } | null;

  if (!body || !isIdList(body.ids) || !isIdList(body.toUserIds)) {
    return badRequest();
  }
  if (body.kind !== "ASSIGN" && body.kind !== "HELP") return badRequest();
  if (body.ids.length !== body.toUserIds.length) {
    return badRequest("요청 id 수와 대상 수가 맞지 않습니다.");
  }
  // 대상은 할일 또는 단계 중 정확히 하나
  const taskId = isName(body.taskId) ? body.taskId : null;
  const stageId = isName(body.stageId) ? body.stageId : null;
  if ((taskId === null) === (stageId === null)) {
    return badRequest("요청 대상은 할일 또는 단계 중 하나여야 합니다.");
  }
  // 보낸 사람은 클라이언트 주장이 아닌 세션 사용자로 고정하고, 자기 자신은 대상에서 뺀다
  if (body.toUserIds.includes(user.id)) {
    return badRequest("자기 자신에게는 요청할 수 없습니다.");
  }

  await createRequests({
    ids: body.ids,
    kind: body.kind,
    fromUserId: user.id,
    toUserIds: body.toUserIds,
    message: isName(body.message) ? body.message.trim() : null,
    taskId,
    stageId,
  });
  return NextResponse.json({ ok: true });
}
