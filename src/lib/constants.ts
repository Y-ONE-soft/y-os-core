// 세션 쿠키 이름 — proxy(edge)와 서버 코드 양쪽에서 쓰므로 서버 전용 모듈에 두지 않는다.
export const SESSION_COOKIE = "yos_session";

// 스탭에게 배정된 프로젝트 — 배정(멤버) 도메인 도입 전 자리표시.
// 디자인(Task Status — Staff) 기준 Soft 그룹 3개 프로젝트.
export const STAFF_ASSIGNED_PROJECT_IDS = ["p-cms", "p-yos", "p-contents"];
