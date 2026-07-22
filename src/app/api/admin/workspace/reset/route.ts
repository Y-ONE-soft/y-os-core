import { NextResponse } from "next/server";

import { currentUser, forbidden, unauthorized } from "@/app/api/admin/guard";
import { resetWorkspace } from "@/server/workspace/service";

export async function POST() {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (user.role !== "MASTER") return forbidden();
  await resetWorkspace();
  return NextResponse.json({ ok: true });
}
