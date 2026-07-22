// 세션 쿠키 이름 — proxy(edge)와 서버 코드 양쪽에서 쓰므로 서버 전용 모듈에 두지 않는다.
export const SESSION_COOKIE = "yos_session";

// 팀 멤버 — 멤버 도메인 도입 전 자리표시 (디자인 Stage Detail Overlay 기준).
export const TEAM_MEMBERS = [
  { id: "m-kim", name: "김서연", title: "기획", color: "#3b82f6" },
  { id: "m-park", name: "박지훈", title: "개발", color: "#8b5cf6" },
  { id: "m-lee", name: "이민아", title: "디자인", color: "#10b981" },
  { id: "m-choi", name: "최현우", title: "개발", color: "#f59e0b" },
];
