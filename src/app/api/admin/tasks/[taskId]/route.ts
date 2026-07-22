import { NextResponse } from "next/server";

import { badRequest, currentUser, unauthorized } from "@/app/api/admin/guard";
import { updateTask, type TaskPatch } from "@/server/workspace/service";

const PATCHABLE = [
  "name",
  "done",
  "description",
  "stageId",
  "projectId",
] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
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

  const { taskId } = await params;
  await updateTask(taskId, patch as TaskPatch);
  return NextResponse.json({ ok: true });
}
