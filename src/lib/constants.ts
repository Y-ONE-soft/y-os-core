// 세션 쿠키 이름 — proxy(edge)와 서버 코드 양쪽에서 쓰므로 서버 전용 모듈에 두지 않는다.
export const SESSION_COOKIE = "yos_session";

// (구 TEAM_MEMBERS 자리표시는 제거됨 — 작업자 목록은 GET /api/admin/users, useUsers() 사용)
