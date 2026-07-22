import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/constants";
import { getSessionUser } from "@/server/auth/service";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const user = token ? await getSessionUser(token) : null;

  if (!user) {
    if (token) cookieStore.delete(SESSION_COOKIE);
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  return NextResponse.json({ user });
}
