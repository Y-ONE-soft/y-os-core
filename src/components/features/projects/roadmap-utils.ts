// 로드맵 공용 계산 유틸 — 프로젝트 상세 로드맵과 작업 현황 로드맵이 함께 사용.

export const DAY_MS = 86_400_000;

export function dayOffset(date: string, from: string) {
  return Math.round(
    (new Date(date).getTime() - new Date(from).getTime()) / DAY_MS,
  );
}

export function formatShort(date: string) {
  return date.slice(5).replace("-", "/");
}

// 날짜 헬퍼 — 로컬 시간 기준으로만 다룬다. DB의 startDate/endDate가
// Date가 아닌 YYYY-MM-DD 문자열이라 UTC 파싱이 끼면 하루씩 밀린다.

export function toISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromISO(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

/** YYYY-MM-DD 문자열을 일수만큼 이동시킨다 (월·연 넘김은 Date가 처리) */
export function shiftISO(iso: string, amount: number) {
  return toISO(addDays(fromISO(iso), amount));
}

/** 오늘 날짜(YYYY-MM-DD) — 브라우저 로컬 기준 */
export function todayISO() {
  return toISO(new Date());
}

/**
 * 단계에 편입될 때 잡히는 예정일 — 단계 시작일과 오늘 중 **더 늦은 날짜**.
 * 이미 시작한 단계에 뒤늦게 넣은 작업이 과거 날짜에 놓이지 않게 한다.
 */
export function scheduleFor(stageStartDate: string | undefined) {
  const today = todayISO();
  return stageStartDate && stageStartDate > today ? stageStartDate : today;
}

export function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 종료일이 없는 진행형 막대의 기본 표시 길이(일) */
export const OPEN_ENDED_DAYS = 5;

/** start=시작일만, end=종료일만, move=길이 유지한 채 통째 이동 */
export type DragMode = "start" | "end" | "move";
export type StageDates = { startDate: string; endDate?: string };

/**
 * 막대 드래그 결과 날짜. delta는 이동한 일수(음수 = 왼쪽).
 * 시작일이 종료일을 앞지르지 않도록 클램프해 최소 1일을 보장한다.
 * endDate가 없는 진행형 막대는 화면 표시 길이(OPEN_ENDED_DAYS)를 끝으로 보고 계산하며,
 * 끝을 끌었을 때만 실제 종료일이 생긴다.
 */
export function dragStageDates(
  mode: DragMode,
  startDate: string,
  endDate: string | undefined,
  delta: number,
): StageDates {
  if (mode === "move") {
    return {
      startDate: shiftISO(startDate, delta),
      // 열린 막대는 열린 채로 옮긴다
      endDate: endDate ? shiftISO(endDate, delta) : undefined,
    };
  }
  const effectiveEnd = endDate ?? shiftISO(startDate, OPEN_ENDED_DAYS - 1);
  const span = Math.max(0, dayOffset(effectiveEnd, startDate));
  if (mode === "start") {
    return { startDate: shiftISO(startDate, Math.min(delta, span)), endDate };
  }
  return {
    startDate,
    endDate: shiftISO(effectiveEnd, Math.max(delta, -span)),
  };
}

export function barRange(
  windowStart: string,
  windowDays: number,
  startDate: string,
  endDate?: string,
) {
  const rawStart = dayOffset(startDate, windowStart);
  const startDay = Math.max(0, rawStart);
  const rawDays = endDate
    ? dayOffset(endDate, windowStart) - rawStart + 1
    : OPEN_ENDED_DAYS;
  const days = Math.min(windowDays - startDay, rawDays - (startDay - rawStart));
  return { startDay, days };
}
