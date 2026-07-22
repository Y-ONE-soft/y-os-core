import { NextResponse } from "next/server";

import { badRequest, currentUser, unauthorized } from "@/app/api/admin/guard";
import { updateStage, type StagePatch } from "@/server/workspace/service";

const PATCHABLE = [
  "name",
  "description",
  "done",
  "startDate",
  "endDate",
  "showDeadline",
  "requestedCollaborators",
] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ stageId: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return badRequest();

  const patch: Record<string, unknown> = {};
  for (const key of PATCHABLE) if (key in body) patch[key] = body[key];
  if (Object.keys(patch).length === 0) return badRequest();

  const { stageId } = await params;
  await updateStage(stageId, patch as StagePatch);
  return NextResponse.json({ ok: true });
}
