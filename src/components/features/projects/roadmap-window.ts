// 로드맵 타임라인 계산 — Jira 로드맵식.
// 범위(일/주/개월/분기)는 "화면에 맞추는 창"이 아니라 **확대 배율**이다.
// 타임라인은 오늘 앞뒤로 길게 펼쳐지고, 사용자는 하단 가로 스크롤로 이동한다.

import { DAY_MS, dayOffset } from "@/components/features/projects/roadmap-utils";

export const RANGE_OPTIONS = ["일", "주", "개월", "분기"] as const;
export type RoadmapRange = (typeof RANGE_OPTIONS)[number];

export type RoadmapTick = {
  key: string;
  label: string;
  /** 타임라인 시작일로부터의 오프셋(일) */
  offsetDays: number;
  /** 이 눈금이 속한 연도 — 첫 눈금·연도가 바뀌는 눈금에 표시한다 */
  year: number;
  /** 연도 경계(1월·Q1 등)에서 굵게 표시 */
  yearStart: boolean;
};

export type RoadmapTimeline = {
  /** YYYY-MM-DD */
  start: string;
  /** 전체 길이(일) */
  days: number;
  /** 하루당 픽셀 — 범위(배율)에 따라 달라진다 */
  dayWidth: number;
  /** 타임라인 총 픽셀 폭 */
  width: number;
  ticks: RoadmapTick[];
  /** 오늘 위치(일). 타임라인 밖이면 null */
  todayOffset: number | null;
};

type RangeConfig = {
  dayWidth: number;
  /** 오늘 기준 과거 범위(개월) */
  monthsBefore: number;
  /** 오늘 기준 미래 범위(개월) */
  monthsAfter: number;
  unit: "day" | "week" | "month" | "quarter";
};

const RANGE_CONFIG: Record<RoadmapRange, RangeConfig> = {
  일: { dayWidth: 56, monthsBefore: 1, monthsAfter: 2, unit: "day" },
  주: { dayWidth: 20, monthsBefore: 2, monthsAfter: 4, unit: "week" },
  개월: { dayWidth: 6, monthsBefore: 6, monthsAfter: 12, unit: "month" },
  분기: { dayWidth: 2.4, monthsBefore: 12, monthsAfter: 24, unit: "quarter" },
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
  return new Date(date.getFullYear(), date.getMonth() + amount, date.getDate());
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

/** 헤더용 기간 표기 — 연도를 명시한다. 예: 2026.06.22 ~ 2026.11.22 */
export function formatPeriod(timeline: { start: string; days: number }) {
  const startDate = fromISO(timeline.start);
  const endDate = addDays(startDate, timeline.days - 1);
  const format = (date: Date) =>
    `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
      date.getDate(),
    ).padStart(2, "0")}`;
  return `${format(startDate)} ~ ${format(endDate)}`;
}

export function buildTimeline(
  range: RoadmapRange,
  today: string,
): RoadmapTimeline {
  const config = RANGE_CONFIG[range];
  const todayDate = fromISO(today);

  // 시작을 눈금 단위 경계에 맞춰 잘라 눈금이 어긋나지 않게 한다
  let startDate = addMonths(todayDate, -config.monthsBefore);
  const endDate = addMonths(todayDate, config.monthsAfter);

  if (config.unit === "week") startDate = startOfWeek(startDate);
  if (config.unit === "month")
    startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  if (config.unit === "quarter")
    startDate = new Date(
      startDate.getFullYear(),
      Math.floor(startDate.getMonth() / 3) * 3,
      1,
    );

  const days = diffDays(startDate, endDate);
  const ticks: RoadmapTick[] = [];

  if (config.unit === "day") {
    for (let index = 0; index < days; index += 1) {
      const tickDate = addDays(startDate, index);
      ticks.push({
        key: toISO(tickDate),
        label: `${tickDate.getMonth() + 1}/${tickDate.getDate()}`,
        offsetDays: index,
        year: tickDate.getFullYear(),
        yearStart: tickDate.getMonth() === 0 && tickDate.getDate() === 1,
      });
    }
  } else if (config.unit === "week") {
    for (let cursor = 0; cursor < days; cursor += 7) {
      const tickDate = addDays(startDate, cursor);
      ticks.push({
        key: toISO(tickDate),
        label: `${tickDate.getMonth() + 1}/${tickDate.getDate()}`,
        offsetDays: cursor,
        year: tickDate.getFullYear(),
        yearStart: tickDate.getMonth() === 0 && tickDate.getDate() <= 7,
      });
    }
  } else {
    const step = config.unit === "month" ? 1 : 3;
    for (let index = 0; ; index += 1) {
      const tickDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + index * step,
        1,
      );
      const offsetDays = diffDays(startDate, tickDate);
      if (offsetDays >= days) break;
      ticks.push({
        key: toISO(tickDate),
        label:
          config.unit === "month"
            ? `${tickDate.getMonth() + 1}월`
            : `Q${Math.floor(tickDate.getMonth() / 3) + 1}`,
        offsetDays,
        year: tickDate.getFullYear(),
        yearStart: tickDate.getMonth() === 0,
      });
    }
  }

  const start = toISO(startDate);
  const offset = dayOffset(today, start);

  return {
    start,
    days,
    dayWidth: config.dayWidth,
    width: days * config.dayWidth,
    ticks,
    todayOffset: offset >= 0 && offset < days ? offset : null,
  };
}
