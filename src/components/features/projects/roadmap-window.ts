// 로드맵 타임라인 계산 — Jira 로드맵식.
// 범위(일/주/개월/분기)는 "화면에 맞추는 창"이 아니라 **확대 배율**이다.
// 타임라인은 오늘 앞뒤로 길게 펼쳐지고, 사용자는 하단 가로 스크롤로 이동한다.

import {
  DAY_MS,
  addDays,
  dayOffset,
  fromISO,
  toISO,
} from "@/components/features/projects/roadmap-utils";

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
  unit: "day" | "week" | "month" | "quarter";
};

const RANGE_CONFIG: Record<RoadmapRange, RangeConfig> = {
  일: { dayWidth: 56, unit: "day" },
  주: { dayWidth: 20, unit: "week" },
  개월: { dayWidth: 6, unit: "month" },
  분기: { dayWidth: 2.4, unit: "quarter" },
};

/**
 * 데이터가 하나도 없어도 보장하는 최소 드래그 범위 — 오늘 기준 앞뒤 2년.
 * 배율(일/주/개월/분기)과 무관하게 동일하며, 데이터가 이 범위를 벗어나면 그만큼 넓어진다.
 */
const MIN_MONTHS_BEFORE = 24;
const MIN_MONTHS_AFTER = 24;

/** 타임라인이 반드시 포함해야 하는 데이터 구간 (YYYY-MM-DD) */
export type TimelineBounds = { min?: string; max?: string };

/** 단계 목록에서 타임라인이 감싸야 할 최소·최대 날짜를 뽑는다 */
export function boundsOfStages(
  stages: { startDate?: string; endDate?: string }[],
): TimelineBounds {
  let min: string | undefined;
  let max: string | undefined;
  for (const stage of stages) {
    for (const date of [stage.startDate, stage.endDate]) {
      if (!date) continue;
      if (!min || date < min) min = date;
      if (!max || date > max) max = date;
    }
  }
  return { min, max };
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
  bounds?: TimelineBounds,
): RoadmapTimeline {
  const config = RANGE_CONFIG[range];
  const todayDate = fromISO(today);

  // 기본은 오늘 앞뒤 2년. 데이터가 그 밖에 있으면 거기까지 스크롤해 갈 수 있도록 넓힌다.
  let startDate = addMonths(todayDate, -MIN_MONTHS_BEFORE);
  let endDate = addMonths(todayDate, MIN_MONTHS_AFTER);

  if (bounds?.min) {
    const boundMin = fromISO(bounds.min);
    if (boundMin.getTime() < startDate.getTime()) startDate = boundMin;
  }
  if (bounds?.max) {
    // 종료일 당일이 온전히 보이도록 하루 더 확보한다
    const boundMax = addDays(fromISO(bounds.max), 1);
    if (boundMax.getTime() > endDate.getTime()) endDate = boundMax;
  }

  // 시작을 눈금 단위 경계에 맞춰 잘라 눈금이 어긋나지 않게 한다

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
