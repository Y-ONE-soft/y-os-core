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

/**
 * 오늘 날짜(YYYY-MM-DD) — **브라우저 로컬 기준**.
 * 서버(UTC)에서 계산하면 한국 시간대 기준 하루가 어긋나므로 날짜는 클라이언트에서 만든다.
 */
export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
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
