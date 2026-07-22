import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  isName,
  unauthorized,
} from "@/app/api/admin/guard";
import { createStage } from "@/server/workspace/service";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    projectId?: unknown;
    name?: unknown;
    color?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    showDeadline?: unknown;
  } | null;
  if (
    !body ||
    !isName(body.id) ||
    !isName(body.projectId) ||
    !isName(body.name) ||
    !isName(body.color)
  ) {
    return badRequest();
  }

  await createStage({
    id: body.id,
    projectId: body.projectId,
    name: body.name.trim(),
    color: body.color,
    startDate: typeof body.startDate === "string" ? body.startDate : undefined,
    endDate: typeof body.endDate === "string" ? body.endDate : undefined,
    showDeadline: body.showDeadline === true,
  });
  return NextResponse.json({ ok: true });
}
