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
  if (!body || !isName(body.id) || !isName(body.projectId) || !isName(body.name)) {
    return badRequest();
  }

  await createTask({
    id: body.id,
    projectId: body.projectId,
    stageId: isName(body.stageId) ? body.stageId : null,
    name: body.name.trim(),
  });
  return NextResponse.json({ ok: true });
}
