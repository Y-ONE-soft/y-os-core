import { NextResponse } from "next/server";

import { currentUser, unauthorized } from "@/app/api/admin/guard";
import { getWorkspace } from "@/server/workspace/service";

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  return NextResponse.json(await getWorkspace());
}
