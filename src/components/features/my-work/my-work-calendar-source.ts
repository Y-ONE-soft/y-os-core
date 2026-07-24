// 워크스페이스 데이터 → 내 할일 캘린더 오버레이.
// 단계는 기간(시작~종료)을 주 단위로 자른 막대로, 할일은 예정일 하루짜리 칩으로 만든다.

import type { BoardTask, Project, ProjectBoardData } from "@/types/workspace";
import { OPEN_ENDED_DAYS } from "@/components/features/projects/roadmap-utils";
import {
  backlogTone,
  taskTone,
} from "@/components/features/projects/project-palette";
import {
  gridDay,
  gridDayCount,
  type CalendarGrid,
} from "@/components/features/my-work/my-work-month";
import {
  UNASSIGNED_BOX,
  type CalOverlay,
} from "@/components/features/my-work/my-work-calendar-layout";
import { isMyTask } from "@/components/features/my-work/my-work-scope";

export type CalendarProject = {
  id: string;
  name: string;
  /** 프로젝트 박스 색 */
  color: string;
};

/** 그리드 첫 칸 기준 일자 범위. end는 배타적(start+span). 클램프하지 않아 음수·초과 가능. */
export type DaySpan = { start: number; end: number };

export type CalendarSource = {
  overlays: CalOverlay[];
  projects: Record<string, CalendarProject>;
  /** 이 달에 걸친 단계 수 — 헤더의 "이 달 N건" */
  stageCount: number;
  /**
   * 프로젝트(·미배정)별 **비클램프** 기간 — 배치 모듈이 박스의 continuesLeft/Right를
   * 판정할 때 쓴다. 오버레이는 그리드에 클램프되므로, 그리드 밖으로 이어지는지는
   * 클램프된 오버레이만으로는 알 수 없다(그래서 마감 라벨이 그리드 끝에 잘못 떴다).
   */
  projectSpans: Record<string, DaySpan>;
};

/** 단계의 그리드-일자 범위(비클램프). start=시작 오프셋, end=종료 다음 칸(배타적). */
function rawStageSpan(grid: CalendarGrid, stage: { startDate?: string | null; endDate?: string | null }): DaySpan | null {
  if (!stage.startDate) return null;
  const start = gridDay(grid, stage.startDate);
  const end = stage.endDate ? gridDay(grid, stage.endDate) : start + OPEN_ENDED_DAYS - 1;
  return { start, end: end + 1 };
}

function extendSpan(spans: Record<string, DaySpan>, key: string, span: DaySpan) {
  const current = spans[key];
  spans[key] = current
    ? { start: Math.min(current.start, span.start), end: Math.max(current.end, span.end) }
    : span;
}

/**
 * 단계를 주 단위로 잘라 오버레이로 만든다.
 * 캘린더 배치 모듈이 주별 `{ week, col, span }`을 전제로 하므로
 * 여러 주에 걸친 단계는 주마다 조각을 만든다 (stageId는 같다).
 */
function stageSegments(
  grid: CalendarGrid,
  project: Project,
  stage: ProjectBoardData["stages"][number],
  /** 그 프로젝트 보드에서의 단계 순서 (0-based) — 배지에 1-based로 표시 */
  stageIndex: number,
): CalOverlay[] {
  if (!stage.startDate) return [];

  const rawStart = gridDay(grid, stage.startDate);
  // 종료일이 없는 진행형 단계는 로드맵과 같은 기본 길이로 표시한다.
  const rawEnd = stage.endDate
    ? gridDay(grid, stage.endDate)
    : rawStart + OPEN_ENDED_DAYS - 1;

  const columns = grid.columns;
  const totalDays = gridDayCount(grid);
  const start = Math.max(0, rawStart);
  const end = Math.min(totalDays - 1, rawEnd);
  if (start > end) return []; // 그리드 밖

  const segments: CalOverlay[] = [];
  for (let day = start; day <= end; ) {
    const week = Math.floor(day / columns);
    const weekEnd = (week + 1) * columns - 1;
    const segmentEnd = Math.min(end, weekEnd);
    segments.push({
      kind: "stage",
      week,
      col: day - week * columns,
      span: segmentEnd - day + 1,
      project: project.id,
      stageId: stage.id,
      color: stage.color,
      label: stage.name,
      // 배지는 단계 순번 — 로드맵(project-roadmap·workload-roadmap)과 같은 기준
      stageNo: stageIndex + 1,
      // 마감 배지는 실제 종료일이 든 조각에만 붙인다.
      deadline: stage.showDeadline && segmentEnd === end && rawEnd === end,
      startsHere: day === start && rawStart === start,
      endsHere: segmentEnd === end && rawEnd === end,
    });
    day = segmentEnd + 1;
  }
  return segments;
}

// 미배정 배치 키는 배치 모듈(my-work-calendar-layout)이 소유한다 — 이 키를 가진 칩은
// 박스로 묶이지 않고 빈 레인에 자유 배치된다. 기존 import 경로 호환을 위해 재노출한다.
export { UNASSIGNED_BOX };
const UNASSIGNED_COLOR = "#71717a";

/** 예정일이 잡힌 할일을 그 날짜 칸의 칩으로 만든다 (하루 = span 1) */
function taskChip(
  grid: CalendarGrid,
  boxKey: string,
  color: string,
  task: BoardTask,
): CalOverlay | null {
  if (!task.scheduledDate) return null;

  const day = gridDay(grid, task.scheduledDate);
  if (day < 0 || day >= gridDayCount(grid)) return null; // 그리드 밖

  const week = Math.floor(day / grid.columns);
  return {
    kind: "task",
    week,
    col: day - week * grid.columns,
    span: 1,
    project: boxKey,
    taskId: task.id,
    color,
    label: task.name,
    done: task.done,
    // 마감일보다 예정일이 뒤로 밀렸으면(자동 이월된 미완료 할일) 지연 표시 대상.
    // 예정일 문자열이 마감일보다 크면 지났다는 뜻(YYYY-MM-DD는 사전순 = 날짜순).
    late: Boolean(
      !task.done && task.deadline && task.scheduledDate > task.deadline,
    ),
  };
}

export function buildCalendarSource(
  grid: CalendarGrid,
  projects: Project[],
  boards: Record<string, ProjectBoardData>,
  /** 프로젝트 없는 할일 — 예정일이 있으면 "미배정" 묶음으로 그린다 */
  unassigned: BoardTask[] = [],
  /** 백로그·미배정 할일은 담당자가 이 사용자인 것만 그린다 (단계 막대·단계 할일은 무관) */
  viewerId?: string,
): CalendarSource {
  const overlays: CalOverlay[] = [];
  const meta: Record<string, CalendarProject> = {};
  // 프로젝트별 비클램프 기간 — 그리드에 들어온 오버레이가 하나라도 있는 프로젝트만 담긴다.
  const projectSpans: Record<string, DaySpan> = {};
  let stageCount = 0;

  const totalDays = gridDayCount(grid);
  // 오버레이가 그리드에 실제로 걸치는(잘려서라도 보이는) 단계·할일만 span에 반영한다.
  // 그리드에서 아예 벗어난 것은 박스도 만들지 않으므로 continues 판정에 넣을 필요가 없다.
  const inGrid = (span: DaySpan) => span.start < totalDays && span.end > 0;

  for (const project of projects) {
    const board = boards[project.id];
    const stages = board?.stages ?? [];
    let placed = false;
    stages.forEach((stage, stageIndex) => {
      const segments = stageSegments(grid, project, stage, stageIndex);
      if (segments.length > 0) {
        overlays.push(...segments);
        stageCount += 1;
        placed = true;
        const raw = rawStageSpan(grid, stage);
        if (raw && inGrid(raw)) extendSpan(projectSpans, project.id, raw);
      }
      // 할일 칩은 소속 단계 색을 한 톤 옅게 — 같은 계열이되 단계 막대와 구분된다
      const taskColor = taskTone(stage.color);
      for (const task of stage.tasks) {
        const chip = taskChip(grid, project.id, taskColor, task);
        if (chip) {
          overlays.push(chip);
          placed = true;
          const day = gridDay(grid, task.scheduledDate!);
          extendSpan(projectSpans, project.id, { start: day, end: day + 1 });
        }
      }
    });
    // 백로그 할일도 날짜 칸에 떨어뜨리면 예정일을 가질 수 있다 (덮는 단계가 없을 때).
    // 단, 내 작업이므로 담당자가 나인 것만.
    for (const task of board?.backlog ?? []) {
      if (!isMyTask(task, viewerId)) continue;
      // 단계 없는 백로그 할일은 프로젝트 색을 같은 규칙으로 옅게 쓴다
      const chip = taskChip(grid, project.id, backlogTone(project.color), task);
      if (chip) {
        overlays.push(chip);
        placed = true;
        const day = gridDay(grid, task.scheduledDate!);
        extendSpan(projectSpans, project.id, { start: day, end: day + 1 });
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

  // "프로젝트 없음"(미배정) 할일 — 소속 프로젝트가 없다. UNASSIGNED_BOX 키로 칩을 만들면
  // 배치 모듈이 프로젝트 박스처럼 하나의 그룹 박스(단계 없이 할일만)로 묶는다.
  let hasUnassigned = false;
  for (const task of unassigned) {
    if (!isMyTask(task, viewerId)) continue;
    const chip = taskChip(grid, UNASSIGNED_BOX, UNASSIGNED_COLOR, task);
    if (chip) {
      overlays.push(chip);
      hasUnassigned = true;
      const day = gridDay(grid, task.scheduledDate!);
      extendSpan(projectSpans, UNASSIGNED_BOX, { start: day, end: day + 1 });
    }
  }
  // 그룹 박스에 이름표("프로젝트 없음")를 달기 위한 메타. 실제 프로젝트가 아니므로
  // ProjectBoxItem은 이 키를 상세 링크 없이 이름만 그린다(단계 막대도 없다).
  if (hasUnassigned) {
    meta[UNASSIGNED_BOX] = {
      id: UNASSIGNED_BOX,
      name: "프로젝트 없음",
      color: UNASSIGNED_COLOR,
    };
  }

  return { overlays, projects: meta, stageCount, projectSpans };
}
