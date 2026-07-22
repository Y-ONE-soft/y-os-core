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

/**
 * 레인(행)은 데이터에 박지 않는다 — `my-work-calendar-layout.ts`가 열 범위로 배치를 계산한다.
 * 같은 `project`의 단계 막대는 기간이 겹쳐도 한 레인에 겹쳐 그려진다.
 */
export type CalOverlay =
  | {
      kind: "projectBg";
      week: number;
      col: number;
      span: number;
      project: string;
      color: string;
      label?: string;
    }
  | {
      kind: "stage";
      week: number;
      col: number;
      span: number;
      project: string;
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

// 프로젝트 식별자 — 색이 아니라 이 키로 단계 막대를 묶는다.
const CMS = "CMS";
const YOS = "YOS";
const YOC = "YOC";

export const CAL_OVERLAYS: CalOverlay[] = [
  // W3 (7/12~18) — CMS 통합테스트·운영 단계
  { kind: "projectBg", week: 2, col: 4, span: 3, project: CMS, color: BLUE, label: "CMS" },
  { kind: "stage", week: 2, col: 4, span: 1, project: CMS, color: BLUE, text: BLUE_TEXT, label: "통합테스트", count: 3 },
  { kind: "stage", week: 2, col: 5, span: 2, project: CMS, color: BLUE, text: BLUE_TEXT, label: "운영·유지보수", count: 4 },
  // W4 (7/19~25) — CMS 개발구현(마감)·착수, YOS 프로젝트 정의(마감)
  { kind: "projectBg", week: 3, col: 0, span: 6, project: CMS, color: BLUE },
  { kind: "stage", week: 3, col: 0, span: 6, project: CMS, color: BLUE, text: BLUE_TEXT, label: "개발구현", count: 2, deadline: true },
  { kind: "stage", week: 3, col: 1, span: 3, project: CMS, color: BLUE, text: BLUE_TEXT, label: "착수", count: 1 },
  { kind: "projectBg", week: 3, col: 1, span: 3, project: YOS, color: PURPLE },
  { kind: "stage", week: 3, col: 1, span: 3, project: YOS, color: PURPLE, text: PURPLE_TEXT, label: "프로젝트 정의", count: 1, deadline: true },
  // W5 (7/26~8/1) — YOS 작업 칩, YOC 요구사항 분석(마감)·회의1
  { kind: "task", week: 4, col: 1, span: 1, text: PURPLE_TEXT, label: "PRD" },
  { kind: "task", week: 4, col: 2, span: 1, text: PURPLE_TEXT, label: "설계서 검토", done: true },
  { kind: "projectBg", week: 4, col: 4, span: 2, project: YOC, color: GREEN },
  { kind: "stage", week: 4, col: 4, span: 2, project: YOC, color: GREEN, text: GREEN_TEXT, label: "요구사항 분석", count: 1, deadline: true },
  { kind: "task", week: 4, col: 4, span: 1, text: GREEN_TEXT, label: "회의1" },
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
