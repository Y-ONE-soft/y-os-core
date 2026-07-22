// 내 할일 캘린더의 월 그리드 — 실제 날짜로 주 배열을 만든다.
// 날짜는 DB와 같은 YYYY-MM-DD 문자열 규격으로만 다룬다 (로컬 파싱, TZ 이슈 회피).

import {
  addDays,
  dayOffset,
  toISO,
} from "@/components/features/projects/roadmap-utils";

export const DAYS_PER_WEEK = 7;

export type MonthGrid = {
  year: number;
  /** 0-based */
  month: number;
  /** "2026년 7월" */
  title: string;
  /** null = 이월 칸 */
  weeks: (number | null)[][];
  weekCount: number;
  /** 이 달에 오늘이 있으면 그 일자, 없으면 null */
  todayDate: number | null;
  /** 그리드 첫 칸(첫 주 일요일)의 날짜 */
  gridStart: string;
};

/** base가 속한 달의 그리드. today는 오늘 표시 판정에만 쓴다. */
export function buildMonthGrid(base: Date, today: Date): MonthGrid {
  const year = base.getFullYear();
  const month = base.getMonth();
  const first = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay(); // 0 = 일요일
  const weekCount = Math.ceil((leading + lastDate) / DAYS_PER_WEEK);

  const weeks = Array.from({ length: weekCount }, (_, week) =>
    Array.from({ length: DAYS_PER_WEEK }, (_, day) => {
      const date = week * DAYS_PER_WEEK + day - leading + 1;
      return date >= 1 && date <= lastDate ? date : null;
    }),
  );

  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;

  return {
    year,
    month,
    title: `${year}년 ${month + 1}월`,
    weeks,
    weekCount,
    todayDate: isCurrentMonth ? today.getDate() : null,
    gridStart: toISO(addDays(first, -leading)),
  };
}

/** YYYY-MM-DD → 그리드 첫 칸 기준 일자 index. 그리드 밖이면 음수이거나 총 칸수 이상. */
export function gridDay(grid: MonthGrid, date: string) {
  return dayOffset(date, grid.gridStart);
}

export function gridDayCount(grid: MonthGrid) {
  return grid.weekCount * DAYS_PER_WEEK;
}
