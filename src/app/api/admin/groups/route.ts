import { NextResponse } from "next/server";

import {
  badRequest,
  currentUser,
  forbidden,
  isName,
  unauthorized,
} from "@/app/api/admin/guard";
import { createGroup } from "@/server/workspace/service";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (user.role !== "MASTER") return forbidden();

  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    name?: unknown;
  } | null;
  if (!body || !isName(body.id) || !isName(body.name)) return badRequest();

  await createGroup({ id: body.id, name: body.name.trim() });
  return NextResponse.json({ ok: true });
}
