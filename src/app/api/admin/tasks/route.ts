import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  isName,
  unauthorized,
} from "@/app/api/admin/guard";
import { createTask } from "@/server/workspace/service";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    projectId?: unknown;
    stageId?: unknown;
    name?: unknown;
  } | null;
  if (!body || !isName(body.id) || !isName(body.name)) return badRequest();

  await createTask({
    id: body.id,
    // projectId 미지정(null)은 미배정 작업 — 내 작업에서 만든 직후 상태
    projectId: isName(body.projectId) ? body.projectId : null,
    stageId: isName(body.stageId) ? body.stageId : null,
    name: body.name.trim(),
  });
  return NextResponse.json({ ok: true });
}
