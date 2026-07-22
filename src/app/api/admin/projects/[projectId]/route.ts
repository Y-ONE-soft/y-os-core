import { NextResponse } from "next/server";

import { currentUser, forbidden, unauthorized } from "@/app/api/admin/guard";
import { deleteProject } from "@/server/workspace/service";

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
