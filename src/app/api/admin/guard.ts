import { NextResponse } from "next/server";

// 관리 API 공통 가드/응답 헬퍼 — route.ts가 아니므로 라우트로 노출되지 않는다.
export { currentUser } from "@/server/auth/session";

export const unauthorized = () =>
  NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

export const forbidden = () =>
  NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

export const badRequest = (message = "잘못된 요청입니다.") =>
  NextResponse.json({ error: message }, { status: 400 });

/** 필수 문자열 필드 검증 */
export const isName = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/** YYYY-MM-DD — Stage/Task의 날짜 표기 규격 */
export const isISODate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** HH:mm (24시간) — Task의 예정 시각 표기 규격 */
export const isTimeOfDay = (value: unknown): value is string =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/**
 * 프로젝트를 만들 그룹 결정 — 스탭은 클라이언트가 보낸 groupId를 신뢰하지 않고 세션
 * 사용자의 소속 그룹으로 강제한다(남의 그룹에 생성하는 우회 차단). 마스터는 전체
 * 그룹을 다루므로 요청 값을 그대로 쓴다. POST /api/admin/projects와 같은 규칙이다.
 *
 * 반환값이 문자열이면 그룹 id, 아니면 그대로 응답할 에러다.
 */
export function resolveProjectGroupId(
  user: { role: string; groupId: string | null },
  requestedGroupId: unknown,
): string | NextResponse {
  if (user.role === "MASTER") {
    if (!isName(requestedGroupId)) return badRequest("그룹을 선택하세요.");
    return requestedGroupId;
  }
  if (!user.groupId) {
    return badRequest("소속 그룹이 없어 프로젝트를 만들 수 없습니다.");
  }
  return user.groupId;
}
