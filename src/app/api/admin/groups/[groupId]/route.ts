import { NextResponse } from "next/server";

import { currentUser, forbidden, unauthorized } from "@/app/api/admin/guard";
import { deleteGroup } from "@/server/workspace/service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (user.role !== "MASTER") return forbidden();

  const { groupId } = await params;
  await deleteGroup(groupId);
  return NextResponse.json({ ok: true });
}
