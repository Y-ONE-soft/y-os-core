import { NextResponse } from "next/server";

import { badRequest, currentUser, forbidden, unauthorized } from "@/app/api/admin/guard";
import {
  applyAcceptedRequest,
  respondToRequest,
} from "@/server/requests/service";

const ALLOWED = ["ACCEPTED", "REJECTED", "CANCELED"] as const;
type Allowed = (typeof ALLOWED)[number];

/** 요청 응답 — 수락·거절은 받은 사람, 취소는 보낸 사람만 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    status?: unknown;
  } | null;
  if (!body || !ALLOWED.includes(body.status as Allowed)) return badRequest();
  const status = body.status as Allowed;

  const { requestId } = await params;
  // 권한·상태 조건을 UPDATE의 where에 함께 넣었으므로, 바뀐 행이 없으면
  // "내 요청이 아니거나 이미 처리됨" 두 경우다 — 둘 다 403으로 응답한다.
  const changed = await respondToRequest({ id: requestId, userId: user.id, status });
  if (!changed) return forbidden();

  if (status === "ACCEPTED") await applyAcceptedRequest(requestId);

  return NextResponse.json({ ok: true });
}
