import { api, ApiError } from "@/lib/api/client";
import type { ProfilePatch, SessionUser } from "@/types/auth";

export function login(username: string, password: string) {
  return api.post<{ user: SessionUser }>("/api/auth/login", {
    username,
    password,
  });
}

export function logout() {
  return api.post<{ ok: boolean }>("/api/auth/logout");
}

/** 현재 세션 사용자 조회 — 미인증(401)은 에러가 아니라 null로 취급한다. */
export async function fetchMe(): Promise<SessionUser | null> {
  try {
    const { user } = await api.get<{ user: SessionUser }>("/api/auth/me");
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** 내 정보 수정 — 수정된 세션 사용자를 그대로 돌려받아 컨텍스트를 갱신한다 */
export async function updateMe(patch: ProfilePatch): Promise<SessionUser> {
  const { user } = await api.patch<{ user: SessionUser }>(
    "/api/auth/me",
    patch,
  );
  return user;
}
