import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/constants";
import { getSessionUser } from "@/server/auth/service";
import type { SessionUser } from "@/types/auth";

/** Route Handler에서 현재 세션 사용자를 읽는다 (없으면 null). */
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? getSessionUser(token) : null;
}
