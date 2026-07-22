// 프로젝트 생성 시 단계 일정을 계산하는 순수 모듈.
// 서버(생성 실행)와 클라이언트(생성 전 미리보기)가 같은 결과를 내야 하므로 @/lib에 둔다.
// — src/server는 @/components를 import하지 않는 규약이라 roadmap-utils는 쓸 수 없다.

/** YYYY-MM-DD 문자열 하루 단위 연산. Stage/Task의 날짜 표기 규격과 동일(TZ 이슈 회피) */
export function addDaysISO(iso: string, amount: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  // UTC 기준으로 만들어 로컬 타임존의 DST 보정이 날짜를 밀지 않도록 한다
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + amount);
  return base.toISOString().slice(0, 10);
}

/** start~end를 양끝 포함으로 센 일수. 같은 날이면 1 */
export function inclusiveDays(startDate: string, endDate: string): number {
  const [ys, ms, ds] = startDate.split("-").map(Number);
  const [ye, me, de] = endDate.split("-").map(Number);
  const s = Date.UTC(ys, ms - 1, ds);
  const e = Date.UTC(ye, me - 1, de);
  return Math.floor((e - s) / 86_400_000) + 1;
}

export type StageSpan = { startDate: string; endDate: string };

/** 균등 분할이 불가능한 입력인지 — 라우트 검증과 화면 안내가 같은 기준을 쓰도록 공유한다 */
export function evenSplitError(
  startDate: string,
  endDate: string,
  stageCount: number,
): string | null {
  if (!Number.isInteger(stageCount) || stageCount < 1) {
    return "단계 수는 1 이상의 정수여야 합니다.";
  }
  const total = inclusiveDays(startDate, endDate);
  if (total < 1) return "종료일은 시작일과 같거나 뒤여야 합니다.";
  if (stageCount > total) {
    return `기간이 ${total}일이라 단계를 ${stageCount}개로 나눌 수 없습니다. 단계 수를 ${total}개 이하로 줄이세요.`;
  }
  return null;
}

/**
 * 기간을 stageCount개로 균등 분할한다.
 * 나누어떨어지지 않는 나머지 일수는 앞 단계부터 하루씩 더 준다
 * (뒤에 몰아주면 마지막 단계만 길어져 로드맵이 한쪽으로 치우쳐 보인다).
 *
 * 예) 30일 / 4단계 → 8, 8, 7, 7일
 */
export function splitRangeEvenly(
  startDate: string,
  endDate: string,
  stageCount: number,
): StageSpan[] {
  const error = evenSplitError(startDate, endDate, stageCount);
  if (error) throw new Error(error);

  const total = inclusiveDays(startDate, endDate);
  const base = Math.floor(total / stageCount);
  const remainder = total % stageCount;

  const spans: StageSpan[] = [];
  let cursor = startDate;
  for (let i = 0; i < stageCount; i += 1) {
    const days = base + (i < remainder ? 1 : 0);
    const spanEnd = addDaysISO(cursor, days - 1);
    spans.push({ startDate: cursor, endDate: spanEnd });
    cursor = addDaysISO(spanEnd, 1);
  }
  return spans;
}

/**
 * 프리셋 단계의 상대 오프셋을 실제 날짜로 되돌린다.
 * offsetDays가 없던 단계(날짜 미지정)는 날짜 없이 그대로 둔다 — 프리셋이 담은 "미정" 상태를 보존.
 */
export function presetStageSpan(
  baseDate: string,
  stage: { offsetDays?: number; durationDays?: number },
): { startDate?: string; endDate?: string } {
  if (stage.offsetDays === undefined) return {};
  const startDate = addDaysISO(baseDate, stage.offsetDays);
  // durationDays가 없으면 종료일이 없던 진행형 막대 — 종료일을 만들지 않는다
  if (stage.durationDays === undefined) return { startDate };
  return { startDate, endDate: addDaysISO(startDate, stage.durationDays - 1) };
}
