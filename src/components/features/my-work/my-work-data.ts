// 내 작업 화면 자리표시 데이터 — Figma My Work Layout(147:495)의 예시 값 재현.
// 내 작업/일정 도메인 DB 전환 시 API 경계 흐름으로 교체한다.

export const CAL_TITLE = "2026년 7월";
export const CAL_MONTH_COUNT = 5;
export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
export const TODAY_DATE = 20;

/** null = 이월 칸(뮤트 배경) */
export const WEEKS: (number | null)[][] = [
  [null, null, null, 1, 2, 3, 4],
  [5, 6, 7, 8, 9, 10, 11],
  [12, 13, 14, 15, 16, 17, 18],
  [19, 20, 21, 22, 23, 24, 25],
  [26, 27, 28, 29, 30, 31, null],
];

/** 주차별 레인 수 — 스팬이 몰린 주는 행이 높다 (디자인 W4 = 104px) */
export const WEEK_LANES = [0, 0, 2, 4, 2];

export type CalOverlay =
  | {
      kind: "projectBg";
      week: number;
      col: number;
      span: number;
      lane: number;
      lanes: number;
      color: string;
      label?: string;
    }
  | {
      kind: "stage";
      week: number;
      col: number;
      span: number;
      lane: number;
      color: string;
      text: string;
      label: string;
      count: number;
      deadline?: boolean;
    }
  | {
      kind: "task";
      week: number;
      col: number;
      span: number;
      lane: number;
      text: string;
      label: string;
      done?: boolean;
    };

const BLUE = "#3b82f6";
const BLUE_TEXT = "#1d4ed8";
const PURPLE = "#8b5cf6";
const PURPLE_TEXT = "#6d28d9";
const GREEN = "#10b981";
const GREEN_TEXT = "#047857";

export const CAL_OVERLAYS: CalOverlay[] = [
  // W3 (7/12~18) — CMS 통합테스트·운영 단계
  { kind: "projectBg", week: 2, col: 4, span: 3, lane: 0, lanes: 2, color: BLUE, label: "CMS" },
  { kind: "stage", week: 2, col: 4, span: 1, lane: 0, color: BLUE, text: BLUE_TEXT, label: "통합테스트", count: 3 },
  { kind: "stage", week: 2, col: 5, span: 2, lane: 0, color: BLUE, text: BLUE_TEXT, label: "운영·유지보수", count: 4 },
  // W4 (7/19~25) — CMS 개발구현(마감), YOS 착수·프로젝트 정의(마감)
  { kind: "projectBg", week: 3, col: 0, span: 6, lane: 0, lanes: 2, color: BLUE },
  { kind: "stage", week: 3, col: 0, span: 6, lane: 0, color: BLUE, text: BLUE_TEXT, label: "개발구현", count: 2, deadline: true },
  { kind: "stage", week: 3, col: 1, span: 3, lane: 1, color: BLUE, text: BLUE_TEXT, label: "착수", count: 1 },
  { kind: "projectBg", week: 3, col: 1, span: 3, lane: 2, lanes: 2, color: PURPLE },
  { kind: "stage", week: 3, col: 1, span: 3, lane: 2, color: PURPLE, text: PURPLE_TEXT, label: "프로젝트 정의", count: 1, deadline: true },
  // W5 (7/26~8/1) — YOS 작업 칩, YOC 요구사항 분석(마감)·회의1
  { kind: "task", week: 4, col: 1, span: 1, lane: 0, text: PURPLE_TEXT, label: "PRD" },
  { kind: "task", week: 4, col: 2, span: 1, lane: 0, text: PURPLE_TEXT, label: "설계서 검토", done: true },
  { kind: "projectBg", week: 4, col: 4, span: 2, lane: 0, lanes: 2, color: GREEN },
  { kind: "stage", week: 4, col: 4, span: 2, lane: 0, color: GREEN, text: GREEN_TEXT, label: "요구사항 분석", count: 1, deadline: true },
  { kind: "task", week: 4, col: 4, span: 1, lane: 1, text: GREEN_TEXT, label: "회의1" },
];

export type WorkRequest = {
  id: string;
  typeLabel: string;
  typeTone: "primary" | "warning";
  direction: string;
  date: string;
  code: string;
  title: string;
  from: string;
  message: string;
  actions: ("수락" | "거절" | "요청 취소")[];
};

export const REQUESTS: WorkRequest[] = [
  {
    id: "req-1",
    typeLabel: "작업 할당 요청",
    typeTone: "primary",
    direction: "받은 요청",
    date: "07-20",
    code: "YOC-909",
    title: "회의1",
    from: "노윤기",
    message: '노윤기 → 김주웅  ·  "회의1" 작업을 할당했어요. 확인 부탁드려요.',
    actions: ["수락", "거절", "요청 취소"],
  },
  {
    id: "req-2",
    typeLabel: "도움 요청",
    typeTone: "warning",
    direction: "보낸 요청",
    date: "07-20",
    code: "YOC-909",
    title: "회의1",
    from: "노윤기",
    message: '노윤기 → 김주웅  ·  "회의 안건 정리가 막혀요. 봐주실 수 있나요?"',
    actions: ["요청 취소"],
  },
];

export const MY_TASKS_SEED = [
  "프로젝트 개요서",
  "서비스 설계서",
  "문서작성",
  "PRD",
  "요구사항 정의서",
  "화면설계·프로토타입",
  "CMS 모듈 핵심기능 개발",
  "CMS 모듈 실사용 데이터 반영",
  "CORE 모듈 핵심 기능 개발",
  "회의1",
];
