import { Flag } from "lucide-react";

import { dayOffset } from "@/components/features/projects/roadmap-utils";
import type { RoadmapTimeline } from "@/components/features/projects/roadmap-window";

/**
 * 마감 깃발 — 로드맵/타임라인 타임 격자 위의 특정 날짜에 깃발을 세운다.
 * 프로젝트 마지막일(가장 늦은 단계 종료일)과 데드라인 표시가 켜진 단계 종료일에 쓴다.
 *
 * 타임 격자를 쓰는 화면(RoadmapTimeline 좌표계)이면 어디서든 재사용한다.
 */
export function DeadlineFlag({
  timeline,
  date,
  color,
  title,
}: {
  timeline: RoadmapTimeline;
  /** 깃발을 세울 날짜 (YYYY-MM-DD) */
  date: string;
  color: string;
  title?: string;
}) {
  // 격자 밖이면 그리지 않는다 — 창 범위를 벗어난 마감은 표시할 자리가 없다
  const index = dayOffset(date, timeline.start);
  if (index < 0 || index > timeline.days) return null;

  // 해당 날짜 칸의 오른쪽 끝(마감 = 그날이 끝나는 지점)에 깃대를 세운다
  const left = (index + 1) * timeline.dayWidth;
  return (
    <span
      aria-hidden
      title={title}
      className="pointer-events-none absolute top-0 z-10 -translate-x-1/2"
      style={{ left, color }}
    >
      <Flag className="size-3 fill-current" strokeWidth={0} />
    </span>
  );
}
