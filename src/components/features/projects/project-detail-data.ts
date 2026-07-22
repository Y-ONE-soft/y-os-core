// 프로젝트 보드 도메인 타입 재노출 + 화면 상수.
// 데이터 원본은 DB(Prisma)로 이전됨 — 시드는 src/server/workspace/seed-data.ts,
// 타입 원본은 src/types/workspace.ts (기존 소비자 호환을 위해 여기서 재노출).

export type {
  BoardStage,
  BoardTask,
  ProjectBoardData,
  StageComment,
} from "@/types/workspace";

/** 로드맵 표시 범위 — 2026-07-15 시작 4주(주 단위 눈금), 오늘 = 7/22 고정(자리표시) */
export const ROADMAP = {
  start: "2026-07-15",
  days: 28,
  todayDay: 7,
  ticks: ["7/15", "7/22", "7/29", "8/5"],
};

/** 자리표시 팀 멤버 — 작업 상세 오버레이의 요청 모달 작업자 목록 (멤버 도메인 도입 전) */
export const TEAM_MEMBERS = [
  { id: "m-kim", name: "김서연", role: "기획", color: "#3b82f6" },
  { id: "m-park", name: "박지훈", role: "개발", color: "#8b5cf6" },
  { id: "m-lee", name: "이민아", role: "디자인", color: "#10b981" },
  { id: "m-choi", name: "최현우", role: "개발", color: "#ef4444" },
] as const;
