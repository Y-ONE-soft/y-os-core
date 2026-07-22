// 워크스페이스 데이터 → 내 작업 캘린더 오버레이.
// 단계만 실데이터다. 할일 칩은 Task에 예정일이 생기면 여기서 함께 만든다.

import type { Project, ProjectBoardData } from "@/types/workspace";
import { OPEN_ENDED_DAYS } from "@/components/features/projects/roadmap-utils";
import {
  DAYS_PER_WEEK,
  gridDay,
  gridDayCount,
  type MonthGrid,
} from "@/components/features/my-work/my-work-month";
import type { CalOverlay } from "@/components/features/my-work/my-work-calendar-layout";

export type CalendarProject = {
  id: string;
  name: string;
  /** 프로젝트 박스 색 */
  color: string;
};

export type CalendarSource = {
  overlays: CalOverlay[];
  projects: Record<string, CalendarProject>;
  /** 이 달에 걸친 단계 수 — 헤더의 "이 달 N건" */
  stageCount: number;
};

/**
 * 단계를 주 단위로 잘라 오버레이로 만든다.
 * 캘린더 배치 모듈이 주별 `{ week, col, span }`을 전제로 하므로
 * 여러 주에 걸친 단계는 주마다 조각을 만든다 (stageId는 같다).
 */
function stageSegments(
  grid: MonthGrid,
  project: Project,
  stage: ProjectBoardData["stages"][number],
): CalOverlay[] {
  if (!stage.startDate) return [];

  const rawStart = gridDay(grid, stage.startDate);
  // 종료일이 없는 진행형 단계는 로드맵과 같은 기본 길이로 표시한다.
  const rawEnd = stage.endDate
    ? gridDay(grid, stage.endDate)
    : rawStart + OPEN_ENDED_DAYS - 1;

  const totalDays = gridDayCount(grid);
  const start = Math.max(0, rawStart);
  const end = Math.min(totalDays - 1, rawEnd);
  if (start > end) return []; // 이 달 그리드 밖

  const segments: CalOverlay[] = [];
  for (let day = start; day <= end; ) {
    const week = Math.floor(day / DAYS_PER_WEEK);
    const weekEnd = (week + 1) * DAYS_PER_WEEK - 1;
    const segmentEnd = Math.min(end, weekEnd);
    segments.push({
      kind: "stage",
      week,
      col: day - week * DAYS_PER_WEEK,
      span: segmentEnd - day + 1,
      project: project.id,
      stageId: stage.id,
      color: stage.color,
      label: stage.name,
      count: stage.tasks.length,
      // 마감 배지는 실제 종료일이 든 조각에만 붙인다.
      deadline: stage.showDeadline && segmentEnd === end && rawEnd === end,
    });
    day = segmentEnd + 1;
  }
  return segments;
}

export function buildCalendarSource(
  grid: MonthGrid,
  projects: Project[],
  boards: Record<string, ProjectBoardData>,
): CalendarSource {
  const overlays: CalOverlay[] = [];
  const meta: Record<string, CalendarProject> = {};
  let stageCount = 0;

  for (const project of projects) {
    const stages = boards[project.id]?.stages ?? [];
    let placed = false;
    for (const stage of stages) {
      const segments = stageSegments(grid, project, stage);
      if (segments.length === 0) continue;
      overlays.push(...segments);
      stageCount += 1;
      placed = true;
    }
    if (placed) {
      meta[project.id] = {
        id: project.id,
        name: project.name,
        color: project.color,
      };
    }
  }

  return { overlays, projects: meta, stageCount };
}
