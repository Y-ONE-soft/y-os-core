import { NextResponse } from "next/server";

import { currentUser, unauthorized } from "@/app/api/admin/guard";
import { listUsers } from "@/server/users/service";

/** 작업자 선택 목록 — 요청 대상을 고르려면 로그인한 사용자 누구나 조회할 수 있어야 한다. */
export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();

  const users = await listUsers();
  return NextResponse.json({ users });
}
