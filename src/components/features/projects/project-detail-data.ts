// 프로젝트 보드 도메인 타입 + 시드 데이터.
// 시드 값은 Figma Project Detail Layout(96:166)의 예시를 YOS 프로젝트에 매핑한 것.
// 단계/작업/백로그는 아직 DB에 없는 도메인 — localStorage 스토어(board-store) 기반이며
// 데이터 태스크에서 API 경계 흐름으로 교체한다.

export type BoardTask = { id: string; name: string; done: boolean };

export type StageComment = {
  id: string;
  author: string;
  text: string;
  /** ISO 문자열 */
  at: string;
};

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
  /** 단계 완료 체크 (상세 오버레이 제목 체크박스) */
  done?: boolean;
  /** 상세 내용 메모 */
  description?: string;
  comments?: StageComment[];
  /** 공동 작업자 지정 요청 보낸 멤버 id (멤버 도메인 전 자리표시) */
  requestedCollaborators?: string[];
  /** ISO 문자열 — 상세 오버레이 푸터 표기용 */
  createdAt?: string;
  updatedAt?: string;
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
  "p-cms": {
    stages: [
      {
        id: "st-cms-kickoff",
        name: "착수",
        color: "#3b82f6",
        startDate: "2026-07-20",
        showDeadline: true,
        tasks: [],
      },
      {
        id: "st-cms-define",
        name: "프로젝트정의",
        color: "#8b5cf6",
        showDeadline: false,
        tasks: [],
      },
      {
        id: "st-cms-build",
        name: "개발·구현",
        color: "#10b981",
        startDate: "2026-07-22",
        endDate: "2026-07-23",
        showDeadline: true,
        tasks: [],
      },
      {
        id: "st-cms-test",
        name: "통합테스트",
        color: "#06b6d4",
        startDate: "2026-07-16",
        endDate: "2026-07-17",
        showDeadline: true,
        tasks: [],
      },
      {
        id: "st-cms-accept",
        name: "고객검수",
        color: "#f59e0b",
        showDeadline: false,
        tasks: [],
      },
      {
        id: "st-cms-deliver",
        name: "납품·인수인계",
        color: "#ef4444",
        showDeadline: false,
        tasks: [],
      },
      {
        id: "st-cms-ops",
        name: "운영·유지보수",
        color: "#ec4899",
        startDate: "2026-07-17",
        endDate: "2026-07-23",
        showDeadline: true,
        tasks: [],
      },
    ],
    backlog: [],
  },
  "p-contents": {
    stages: [
      {
        id: "st-ct-req",
        name: "요구사항 분석",
        color: "#3b82f6",
        startDate: "2026-07-30",
        endDate: "2026-08-07",
        showDeadline: true,
        tasks: [
          { id: "tk-ct-interview", name: "요구사항 인터뷰", done: false },
          { id: "tk-ct-define", name: "요구사항 정의", done: false },
        ],
      },
      {
        id: "st-ct-design",
        name: "서비스, 시스템 설계",
        color: "#8b5cf6",
        startDate: "2026-08-05",
        endDate: "2026-08-11",
        showDeadline: true,
        tasks: [],
      },
      {
        id: "st-ct-build",
        name: "개발",
        color: "#10b981",
        startDate: "2026-08-10",
        showDeadline: true,
        tasks: [],
      },
    ],
    backlog: [],
  },
  "p-wise": {
    stages: [
      {
        id: "st-ws-ops",
        name: "운영·유지보수",
        color: "#f59e0b",
        startDate: "2026-07-17",
        endDate: "2026-07-23",
        showDeadline: true,
        tasks: [],
      },
    ],
    backlog: [],
  },
};

/** 자리표시 팀 멤버 — 작업 상세 오버레이의 요청 모달 작업자 목록 (멤버 도메인 도입 전) */
export const TEAM_MEMBERS = [
  { id: "m-kim", name: "김서연", role: "기획", color: "#3b82f6" },
  { id: "m-park", name: "박지훈", role: "개발", color: "#8b5cf6" },
  { id: "m-lee", name: "이민아", role: "디자인", color: "#10b981" },
  { id: "m-choi", name: "최현우", role: "개발", color: "#ef4444" },
] as const;
