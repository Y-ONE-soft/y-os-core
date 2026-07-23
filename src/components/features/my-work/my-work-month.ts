// 내 할일 캘린더의 그리드 — 실제 날짜로 칸 배열을 만든다.
// 월(7열×여러 주)·주(7열×1주)·일(1열×1일)을 같은 모양(CalendarGrid)으로 내보내
// 소스·레이아웃·렌더가 뷰와 무관하게 돌아가게 한다.
// 날짜는 DB와 같은 YYYY-MM-DD 문자열 규격으로만 다룬다 (로컬 파싱, TZ 이슈 회피).

import {
  addDays,
  dayOffset,
  fromISO,
  toISO,
} from "@/components/features/projects/roadmap-utils";

export const DAYS_PER_WEEK = 7;

export type CalendarView = "day" | "week" | "month";

export type CalendarGrid = {
  view: CalendarView;
  /** 한 행의 칸 수 — 일=1, 주·월=7 */
  columns: number;
  /** 헤더/제목용 표기 */
  title: string;
  /** 각 행의 칸: 그 날짜의 일(1-31). null = 이월(월 보기에서 다른 달) */
  rows: (number | null)[][];
  /** 행 수 */
  rowCount: number;
  /** 첫 칸의 YYYY-MM-DD */
  gridStart: string;
  /** 오늘 — 셀 강조 비교용(칸의 실제 날짜와 문자열 비교) */
  todayISO: string;
};

/** 이전 이름과의 호환 — 기존 import가 MonthGrid를 참조하던 자리를 잇는다 */
export type MonthGrid = CalendarGrid;

/** base가 속한 달의 그리드 (7열 × 여러 주). today는 오늘 표시 판정에만 쓴다. */
export function buildMonthGrid(base: Date, today: Date): CalendarGrid {
  const year = base.getFullYear();
  const month = base.getMonth();
  const first = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay(); // 0 = 일요일
  const rowCount = Math.ceil((leading + lastDate) / DAYS_PER_WEEK);

  const rows = Array.from({ length: rowCount }, (_, week) =>
    Array.from({ length: DAYS_PER_WEEK }, (_, day) => {
      const date = week * DAYS_PER_WEEK + day - leading + 1;
      return date >= 1 && date <= lastDate ? date : null;
    }),
  );

  return {
    view: "month",
    columns: DAYS_PER_WEEK,
    title: `${year}년 ${month + 1}월`,
    rows,
    rowCount,
    gridStart: toISO(addDays(first, -leading)),
    todayISO: toISO(today),
  };
}

/** base가 속한 주의 그리드 (7열 × 1주). 다른 달로 넘어가도 실제 날짜를 그대로 보여준다. */
export function buildWeekGrid(base: Date, today: Date): CalendarGrid {
  const weekStart = addDays(base, -base.getDay()); // 그 주 일요일
  const gridStartISO = toISO(weekStart);
  const row = Array.from({ length: DAYS_PER_WEEK }, (_, i) =>
    addDays(weekStart, i).getDate(),
  );
  const weekEnd = addDays(weekStart, DAYS_PER_WEEK - 1);

  return {
    view: "week",
    columns: DAYS_PER_WEEK,
    title: `${weekStart.getMonth() + 1}/${weekStart.getDate()} ~ ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`,
    rows: [row],
    rowCount: 1,
    gridStart: gridStartISO,
    todayISO: toISO(today),
  };
}

const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** base 하루만 보여주는 그리드 (1열 × 1일). */
export function buildDayGrid(base: Date, today: Date): CalendarGrid {
  const label = WEEKDAY_LABEL[base.getDay()];
  return {
    view: "day",
    columns: 1,
    title: `${base.getFullYear()}년 ${base.getMonth() + 1}월 ${base.getDate()}일 (${label})`,
    rows: [[base.getDate()]],
    rowCount: 1,
    gridStart: toISO(base),
    todayISO: toISO(today),
  };
}

/** YYYY-MM-DD → 그리드 첫 칸 기준 일자 index. 그리드 밖이면 음수이거나 총 칸수 이상. */
export function gridDay(grid: CalendarGrid, date: string) {
  return dayOffset(date, grid.gridStart);
}

export function gridDayCount(grid: CalendarGrid) {
  return grid.rowCount * grid.columns;
}

/** 열 헤더 — 그리드 첫 칸부터 columns개의 요일 라벨. 일 보기(1열)면 그날 요일만. */
export function gridWeekdayHeaders(
  grid: CalendarGrid,
): { label: string; weekday: number }[] {
  const start = fromISO(grid.gridStart);
  return Array.from({ length: grid.columns }, (_, i) => {
    const weekday = addDays(start, i).getDay();
    return { label: WEEKDAY_LABEL[weekday], weekday };
  });
}
