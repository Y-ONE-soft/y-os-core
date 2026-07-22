import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  forbidden,
  isName,
  unauthorized,
} from "@/app/api/admin/guard";
import { createProject } from "@/server/workspace/service";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (user.role !== "MASTER") return forbidden();

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    groupId?: unknown;
    name?: unknown;
    color?: unknown;
  } | null;
  if (
    !body ||
    !isName(body.id) ||
    !isName(body.groupId) ||
    !isName(body.name) ||
    !isName(body.color)
  ) {
    return badRequest();
  }

  await createProject({
    id: body.id,
    groupId: body.groupId,
    name: body.name.trim(),
    color: body.color,
  });
  return NextResponse.json({ ok: true });
}
