// 프로젝트 상세 화면 자리표시 데이터 — Figma Project Detail Layout(96:166)의 예시 값 그대로.
// 단계/작업/백로그는 아직 스토어·DB에 없는 도메인이라, 데이터 태스크에서 실데이터로 교체한다.

export type BoardTask = { id: string; name: string };

export type Stage = {
  id: string;
  name: string;
  color: string;
  /** 로드맵 라벨 셀의 완료/전체 표기 */
  progressLabel: string;
  /** 칸반 컬럼 헤더 배지 표기 */
  countLabel: string;
  tasks: BoardTask[];
  /** 디자인의 "작업 추가 (입력 중)" 상태 카드 노출 여부 */
  showAddingCard?: boolean;
  bar?: {
    /** 로드맵 범위 시작일로부터의 오프셋(일) */
    startDay: number;
    days: number;
    label: string;
    bg: string;
    border: string;
    text: string;
  };
};

/** 로드맵 표시 범위 — 7/15 시작 4주(주 단위 눈금), 오늘 = 7/22 */
export const ROADMAP = {
  days: 28,
  todayDay: 7,
  ticks: ["7/15", "7/22", "7/29", "8/5"],
};

export const STAGES: Stage[] = [
  {
    id: "s-define",
    name: "프로젝트 정의",
    color: "#3b82f6",
    progressLabel: "0/3",
    countLabel: "07/20~07/24 · 2",
    showAddingCard: true,
    tasks: [
      { id: "t-prd", name: "PRD" },
      { id: "t-req", name: "요구사항 정의서" },
    ],
    bar: {
      startDay: 5,
      days: 5,
      label: "0% · 07/20~07/24",
      bg: "rgba(59,130,246,0.12)",
      border: "rgba(59,130,246,0.8)",
      text: "#3b82f6",
    },
  },
  {
    id: "s-design",
    name: "서비스·기술 설계",
    color: "#8b5cf6",
    progressLabel: "0/2",
    countLabel: "1",
    tasks: [{ id: "t-proto", name: "화면설계·프로토타입" }],
  },
  {
    id: "s-build",
    name: "개발·구현",
    color: "#10b981",
    progressLabel: "0/3",
    countLabel: "3",
    tasks: [
      { id: "t-cms-core", name: "CMS 모듈 핵심기능 개발" },
      { id: "t-cms-data", name: "CMS 모듈 실사용 데이터 반영" },
      { id: "t-core", name: "CORE 모듈 핵심 기능 개발" },
    ],
  },
];

export const BACKLOG_ITEMS: BoardTask[] = [
  { id: "b-overview", name: "프로젝트 개요서" },
  { id: "b-service", name: "서비스 설계서" },
];
