import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  forbidden,
  unauthorized,
} from "@/app/api/admin/guard";
import { deleteProject, updateProject } from "@/server/workspace/service";

/** #rrggbb 만 허용 — 스타일에 그대로 들어가는 값이라 형식을 좁게 잡는다 */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    color?: unknown;
  } | null;
  if (!body || typeof body.color !== "string" || !HEX_COLOR.test(body.color)) {
    return badRequest();
  }

  const { projectId } = await params;
  const isMaster = user.role === "MASTER";

  // 삭제와 동일한 범위 — 마스터는 전체, 스탭은 자기가 작업자인 프로젝트만
  const { count } = await updateProject(
    projectId,
    { color: body.color },
    isMaster ? undefined : { ownerId: user.id },
  );
  if (count === 0) return forbidden();

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { projectId } = await params;
  const isMaster = user.role === "MASTER";

  // 마스터는 전체 프로젝트를, 스탭은 자기가 작업자인 프로젝트만 지운다.
  // (스탭 사이드바가 ownerId로 필터링하는 범위와 동일 — projects-nav.tsx)
  const { count } = await deleteProject(
    projectId,
    isMaster ? undefined : { ownerId: user.id },
  );

  // 스탭이 0건이면 남의 프로젝트이거나 이미 없는 것 — 존재 여부를 흘리지 않도록
  // 구분 없이 403. 마스터는 종전대로 멱등하게 ok (없는 id 삭제도 성공 취급).
  if (!isMaster && count === 0) return forbidden();

  return NextResponse.json({ ok: true });
}
