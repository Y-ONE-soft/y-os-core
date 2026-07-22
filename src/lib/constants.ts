// 세션 쿠키 이름 — proxy(edge)와 서버 코드 양쪽에서 쓰므로 서버 전용 모듈에 두지 않는다.
export const SESSION_COOKIE = "yos_session";

// 로그인 직후 도착할 화면. 로그인 폼과 proxy(이미 로그인된 채로 /login 접근) 두 곳이
// 같은 값을 써야 어긋나지 않으므로 상수로 모아 둔다.
export const AFTER_LOGIN_PATH = "/projects";

// (구 TEAM_MEMBERS 자리표시는 제거됨 — 작업자 목록은 GET /api/admin/users, useUsers() 사용)
