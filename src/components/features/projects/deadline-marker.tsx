import { dayOffset } from "@/components/features/projects/roadmap-utils";
import type { RoadmapTimeline } from "@/components/features/projects/roadmap-window";

/**
 * 마감 라벨 — 로드맵/타임라인 타임 격자 위의 특정 날짜에 "마감" 배지를 붙인다.
 * 프로젝트 마지막일(가장 늦은 단계 종료일)과 데드라인 표시가 켜진 단계 종료일에 쓴다.
 * 캘린더 뷰의 단계 마감 배지와 같은 표기(작은 색 배지 + "마감").
 *
 * 타임 격자를 쓰는 화면(RoadmapTimeline 좌표계)이면 어디서든 재사용한다.
 */
export function DeadlineMarker({
  timeline,
  date,
  color,
  title,
}: {
  timeline: RoadmapTimeline;
  /** 마감 날짜 (YYYY-MM-DD) */
  date: string;
  color: string;
  title?: string;
}) {
  // 격자 밖이면 그리지 않는다 — 창 범위를 벗어난 마감은 표시할 자리가 없다
  const index = dayOffset(date, timeline.start);
  if (index < 0 || index > timeline.days) return null;

  // 마감 = 그날이 끝나는 지점이라 칸의 오른쪽 끝에 맞춘다. 배지는 그 왼쪽(막대
  // 안쪽)으로 붙여 격자 밖으로 삐져나가지 않게 한다.
  const left = (index + 1) * timeline.dayWidth;
  return (
    <span
      title={title}
      className="pointer-events-none absolute top-0 z-10 -translate-x-full rounded-[3px] px-1 py-px text-[8px] font-medium text-white"
      style={{ left, backgroundColor: color }}
    >
      마감
    </span>
  );
}
