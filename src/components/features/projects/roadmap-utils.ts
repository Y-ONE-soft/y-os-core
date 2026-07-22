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
