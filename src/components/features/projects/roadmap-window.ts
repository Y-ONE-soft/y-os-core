// 로드맵 표시 창(range) 계산 — 일/주/개월/분기 스위처가 이 모듈로 창을 만든다.
// 고정 상수(ROADMAP)를 대체하며, 오늘 기준으로 창을 잡고 page로 앞뒤 이동한다.

import { DAY_MS, dayOffset } from "@/components/features/projects/roadmap-utils";

export const RANGE_OPTIONS = ["일", "주", "개월", "분기"] as const;
export type RoadmapRange = (typeof RANGE_OPTIONS)[number];

export type RoadmapTick = {
  label: string;
  /** 창 시작일로부터의 오프셋(일) */
  offsetDays: number;
};

export type RoadmapWindow = {
  /** YYYY-MM-DD */
  start: string;
  /** 창 전체 길이(일) */
  days: number;
  ticks: RoadmapTick[];
  /** 오늘 위치(일). 창 밖이면 null */
  todayOffset: number | null;
};

function toISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromISO(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

/** 주 시작 = 월요일 */
function startOfWeek(date: Date) {
  const day = date.getDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

function diffDays(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export function todayISO() {
  return toISO(new Date());
}

/**
 * 오늘을 기준으로 창을 만든다. 각 범위는 "직전 1단위 + 이후"를 보여줘
 * 오늘이 두 번째 칸에 오도록 맞춘다 (기존 주간 뷰의 배치와 동일).
 * page: -1 = 이전 창, +1 = 다음 창
 */
export function buildRoadmapWindow(
  range: RoadmapRange,
  today: string,
  page = 0,
): RoadmapWindow {
  const todayDate = fromISO(today);
  let startDate: Date;
  let days: number;
  const ticks: RoadmapTick[] = [];

  if (range === "일") {
    const COLUMNS = 7;
    startDate = addDays(todayDate, -1 + page * COLUMNS);
    days = COLUMNS;
    for (let index = 0; index < COLUMNS; index += 1) {
      const tickDate = addDays(startDate, index);
      ticks.push({
        label: `${tickDate.getMonth() + 1}/${tickDate.getDate()}`,
        offsetDays: index,
      });
    }
  } else if (range === "주") {
    const COLUMNS = 4;
    startDate = addDays(startOfWeek(todayDate), -7 + page * COLUMNS * 7);
    days = COLUMNS * 7;
    for (let index = 0; index < COLUMNS; index += 1) {
      const tickDate = addDays(startDate, index * 7);
      ticks.push({
        label: `${tickDate.getMonth() + 1}/${tickDate.getDate()}`,
        offsetDays: index * 7,
      });
    }
  } else if (range === "개월") {
    const COLUMNS = 3;
    const monthStart = new Date(
      todayDate.getFullYear(),
      todayDate.getMonth(),
      1,
    );
    startDate = addMonths(monthStart, -1 + page * COLUMNS);
    days = diffDays(startDate, addMonths(startDate, COLUMNS));
    for (let index = 0; index < COLUMNS; index += 1) {
      const tickDate = addMonths(startDate, index);
      ticks.push({
        label: `${tickDate.getMonth() + 1}월`,
        offsetDays: diffDays(startDate, tickDate),
      });
    }
  } else {
    const COLUMNS = 4;
    const quarterStart = new Date(
      todayDate.getFullYear(),
      Math.floor(todayDate.getMonth() / 3) * 3,
      1,
    );
    startDate = addMonths(quarterStart, -3 + page * COLUMNS * 3);
    days = diffDays(startDate, addMonths(startDate, COLUMNS * 3));
    for (let index = 0; index < COLUMNS; index += 1) {
      const tickDate = addMonths(startDate, index * 3);
      ticks.push({
        label: `${String(tickDate.getFullYear()).slice(2)} Q${Math.floor(tickDate.getMonth() / 3) + 1}`,
        offsetDays: diffDays(startDate, tickDate),
      });
    }
  }

  const start = toISO(startDate);
  const offset = dayOffset(today, start);

  return {
    start,
    days,
    ticks,
    todayOffset: offset >= 0 && offset < days ? offset : null,
  };
}
