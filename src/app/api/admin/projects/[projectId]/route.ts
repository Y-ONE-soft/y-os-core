import { NextResponse } from "next/server";

import { currentUser, forbidden, unauthorized } from "@/app/api/admin/guard";
import { deleteProject } from "@/server/workspace/service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (user.role !== "MASTER") return forbidden();

  const { projectId } = await params;
  await deleteProject(projectId);
  return NextResponse.json({ ok: true });
}
