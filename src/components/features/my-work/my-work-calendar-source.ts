// 워크스페이스 데이터 → 내 할일 캘린더 오버레이.
// 단계는 기간(시작~종료)을 주 단위로 자른 막대로, 할일은 예정일 하루짜리 칩으로 만든다.

import type { BoardTask, Project, ProjectBoardData } from "@/types/workspace";
import { OPEN_ENDED_DAYS } from "@/components/features/projects/roadmap-utils";
import { taskTone } from "@/components/features/projects/project-palette";
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
      startsHere: day === start && rawStart === start,
      endsHere: segmentEnd === end && rawEnd === end,
    });
    day = segmentEnd + 1;
  }
  return segments;
}

/**
 * 프로젝트 없는(미배정) 할일을 묶는 가짜 프로젝트 키.
 * 캘린더 박스는 `project` 문자열로 묶이므로, 미배정도 같은 방식으로 한 묶음이 된다.
 */
export const UNASSIGNED_BOX = "__unassigned__";
const UNASSIGNED_COLOR = "#71717a";

/** 예정일이 잡힌 할일을 그 날짜 칸의 칩으로 만든다 (하루 = span 1) */
function taskChip(
  grid: MonthGrid,
  boxKey: string,
  color: string,
  task: BoardTask,
): CalOverlay | null {
  if (!task.scheduledDate) return null;

  const day = gridDay(grid, task.scheduledDate);
  if (day < 0 || day >= gridDayCount(grid)) return null; // 이 달 그리드 밖

  const week = Math.floor(day / DAYS_PER_WEEK);
  return {
    kind: "task",
    week,
    col: day - week * DAYS_PER_WEEK,
    span: 1,
    project: boxKey,
    taskId: task.id,
    color,
    label: task.name,
    done: task.done,
  };
}

export function buildCalendarSource(
  grid: MonthGrid,
  projects: Project[],
  boards: Record<string, ProjectBoardData>,
  /** 프로젝트 없는 할일 — 예정일이 있으면 "미배정" 묶음으로 그린다 */
  unassigned: BoardTask[] = [],
): CalendarSource {
  const overlays: CalOverlay[] = [];
  const meta: Record<string, CalendarProject> = {};
  let stageCount = 0;

  for (const project of projects) {
    const board = boards[project.id];
    const stages = board?.stages ?? [];
    let placed = false;
    for (const stage of stages) {
      const segments = stageSegments(grid, project, stage);
      if (segments.length > 0) {
        overlays.push(...segments);
        stageCount += 1;
        placed = true;
      }
      // 할일 칩은 소속 단계 색을 한 톤 옅게 — 같은 계열이되 단계 막대와 구분된다
      const taskColor = taskTone(stage.color);
      for (const task of stage.tasks) {
        const chip = taskChip(grid, project.id, taskColor, task);
        if (chip) {
          overlays.push(chip);
          placed = true;
        }
      }
    }
    // 백로그 할일도 날짜 칸에 떨어뜨리면 예정일을 가질 수 있다 (덮는 단계가 없을 때)
    for (const task of board?.backlog ?? []) {
      // 단계 없는 백로그 할일은 프로젝트 색을 같은 규칙으로 옅게 쓴다
      const chip = taskChip(grid, project.id, taskTone(project.color), task);
      if (chip) {
        overlays.push(chip);
        placed = true;
      }
    }
    if (placed) {
      meta[project.id] = {
        id: project.id,
        name: project.name,
        color: project.color,
      };
    }
  }

  // 미배정 할일은 소속 프로젝트가 없어 어느 박스에도 못 들어간다 — 전용 묶음으로 모은다
  let hasUnassigned = false;
  for (const task of unassigned) {
    const chip = taskChip(grid, UNASSIGNED_BOX, UNASSIGNED_COLOR, task);
    if (chip) {
      overlays.push(chip);
      hasUnassigned = true;
    }
  }
  if (hasUnassigned) {
    meta[UNASSIGNED_BOX] = {
      id: UNASSIGNED_BOX,
      name: "미배정",
      color: UNASSIGNED_COLOR,
    };
  }

  return { overlays, projects: meta, stageCount };
}
