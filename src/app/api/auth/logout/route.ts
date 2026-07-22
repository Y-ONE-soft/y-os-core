import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/constants";
import { logout } from "@/server/auth/service";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await logout(token);
  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
