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
 * 레인(행)과 프로젝트 박스 범위는 데이터에 박지 않는다.
 * `my-work-calendar-layout.ts`가 소속 항목의 열 범위에서 계산한다.
 */
export type CalOverlay =
  | {
      kind: "stage";
      week: number;
      col: number;
      span: number;
      project: string;
      label: string;
      count: number;
      deadline?: boolean;
    }
  | {
      kind: "task";
      week: number;
      col: number;
      span: number;
      project: string;
      label: string;
      done?: boolean;
    };

const BLUE = "#3b82f6";
const BLUE_TEXT = "#1d4ed8";
const PURPLE = "#8b5cf6";
const PURPLE_TEXT = "#6d28d9";
const GREEN = "#10b981";
const GREEN_TEXT = "#047857";

// 프로젝트 식별자 — 색이 아니라 이 키로 단계·할일을 묶는다.
const CMS = "CMS";
const YOS = "YOS";
const YOC = "YOC";

export type ProjectMeta = { color: string; text: string };

/** 프로젝트별 색 — 오버레이 행마다 색을 반복하지 않는다. */
export const PROJECTS: Record<string, ProjectMeta> = {
  [CMS]: { color: BLUE, text: BLUE_TEXT },
  [YOS]: { color: PURPLE, text: PURPLE_TEXT },
  [YOC]: { color: GREEN, text: GREEN_TEXT },
};

/** 프로젝트 박스에 이름을 띄울 주차 — 지정한 곳에만 라벨이 붙는다. */
export const PROJECT_BOX_LABELS: { week: number; project: string; label: string }[] = [
  { week: 2, project: CMS, label: "CMS" },
];

export const CAL_OVERLAYS: CalOverlay[] = [
  // W3 (7/12~18) — CMS 통합테스트·운영 단계
  { kind: "stage", week: 2, col: 4, span: 1, project: CMS, label: "통합테스트", count: 3 },
  { kind: "stage", week: 2, col: 5, span: 2, project: CMS, label: "운영·유지보수", count: 4 },
  // W4 (7/19~25) — CMS 개발구현(마감)·착수, YOS 프로젝트 정의(마감)
  { kind: "stage", week: 3, col: 0, span: 6, project: CMS, label: "개발구현", count: 2, deadline: true },
  { kind: "stage", week: 3, col: 1, span: 3, project: CMS, label: "착수", count: 1 },
  { kind: "stage", week: 3, col: 1, span: 3, project: YOS, label: "프로젝트 정의", count: 1, deadline: true },
  // W5 (7/26~8/1) — YOS 작업 칩, YOC 요구사항 분석(마감)·회의1
  { kind: "task", week: 4, col: 1, span: 1, project: YOS, label: "PRD" },
  { kind: "task", week: 4, col: 2, span: 1, project: YOS, label: "설계서 검토", done: true },
  { kind: "stage", week: 4, col: 4, span: 2, project: YOC, label: "요구사항 분석", count: 1, deadline: true },
  { kind: "task", week: 4, col: 4, span: 1, project: YOC, label: "회의1" },
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
