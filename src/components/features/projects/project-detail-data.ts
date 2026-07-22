// 프로젝트 보드 도메인 타입 + 시드 데이터.
// 시드 값은 Figma Project Detail Layout(96:166)의 예시를 YOS 프로젝트에 매핑한 것.
// 단계/작업/백로그는 아직 DB에 없는 도메인 — localStorage 스토어(board-store) 기반이며
// 데이터 태스크에서 API 경계 흐름으로 교체한다.

export type BoardTask = { id: string; name: string; done: boolean };

export type BoardStage = {
  id: string;
  name: string;
  color: string;
  /** YYYY-MM-DD */
  startDate?: string;
  /** YYYY-MM-DD */
  endDate?: string;
  /** 로드맵 막대·보드 컬럼 헤더에 기간(마감) 표시 여부 */
  showDeadline: boolean;
  tasks: BoardTask[];
};

export type ProjectBoardData = {
  stages: BoardStage[];
  backlog: BoardTask[];
};

/** 로드맵 표시 범위 — 2026-07-15 시작 4주(주 단위 눈금), 오늘 = 7/22 고정(자리표시) */
export const ROADMAP = {
  start: "2026-07-15",
  days: 28,
  todayDay: 7,
  ticks: ["7/15", "7/22", "7/29", "8/5"],
};

export const BOARD_SEED: Record<string, ProjectBoardData> = {
  "p-yos": {
    stages: [
      {
        id: "st-define",
        name: "프로젝트 정의",
        color: "#3b82f6",
        startDate: "2026-07-20",
        endDate: "2026-07-24",
        showDeadline: true,
        tasks: [
          { id: "tk-prd", name: "PRD", done: false },
          { id: "tk-req", name: "요구사항 정의서", done: false },
        ],
      },
      {
        id: "st-design",
        name: "서비스·기술 설계",
        color: "#8b5cf6",
        showDeadline: false,
        tasks: [{ id: "tk-proto", name: "화면설계·프로토타입", done: false }],
      },
      {
        id: "st-build",
        name: "개발·구현",
        color: "#10b981",
        showDeadline: false,
        tasks: [
          { id: "tk-cms-core", name: "CMS 모듈 핵심기능 개발", done: false },
          { id: "tk-cms-data", name: "CMS 모듈 실사용 데이터 반영", done: false },
          { id: "tk-core", name: "CORE 모듈 핵심 기능 개발", done: false },
        ],
      },
    ],
    backlog: [
      { id: "bk-overview", name: "프로젝트 개요서", done: false },
      { id: "bk-service", name: "서비스 설계서", done: false },
    ],
  },
};
