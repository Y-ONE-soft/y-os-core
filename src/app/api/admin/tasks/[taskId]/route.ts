import { NextResponse } from "next/server";

import { badRequest, currentUser, unauthorized } from "@/app/api/admin/guard";
import {
  deleteTask,
  updateTask,
  type TaskPatch,
} from "@/server/workspace/service";

// completedDate는 일부러 뺐다 — done 전환에 맞춰 서버(updateTask)가 채우는 값이라
// 클라이언트가 직접 보내면 임의 날짜로 완료 기록을 위조할 수 있다.
const PATCHABLE = [
  "name",
  "done",
  "description",
  "stageId",
  "projectId",
  "scheduledDate",
  "scheduledTime",
  "assigneeId",
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { taskId } = await params;
  await deleteTask(taskId);
  return NextResponse.json({ ok: true });
}
