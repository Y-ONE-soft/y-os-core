"use client";

import { useMemo, useState } from "react";

import { useSession } from "@/components/features/auth/session-context";
import { useProjectStore } from "@/components/features/projects/project-store";
import {
  boardActions,
  useBoardState,
  useUnassignedTasks,
} from "@/components/features/projects/board-store";
import {
  addDays,
  dragStageDates,
  fromISO,
  shiftISO,
  toISO,
  type DragMode,
  type StageDates,
} from "@/components/features/projects/roadmap-utils";
import type { BoardStage } from "@/types/workspace";
import { StageDetailOverlay } from "@/components/features/projects/stage-detail-overlay";
import { TaskDetailOverlay } from "@/components/features/projects/task-detail-overlay";
import {
  MyWorkCalendar,
  type DragTarget,
} from "@/components/features/my-work/my-work-calendar";
import {
  buildDayGrid,
  buildMonthGrid,
  buildWeekGrid,
  type CalendarView,
} from "@/components/features/my-work/my-work-month";
import { MyWorkCalendarToolbar } from "@/components/features/my-work/my-work-calendar-toolbar";
import { buildCalendarSource } from "@/components/features/my-work/my-work-calendar-source";
import {
  applyMyWorkFilter,
  useMyWorkFilter,
} from "@/components/features/my-work/my-work-filter-store";
import { buildWeekLayouts } from "@/components/features/my-work/my-work-calendar-layout";
import { defaultProjectIdOf } from "@/components/features/my-work/my-work-scope";

export function MyWorkCalendarPanel() {
  const { user } = useSession();
  const filter = useMyWorkFilter();
  const { groups } = useProjectStore();
  const boards = useBoardState();
  const unassigned = useUnassignedTasks();

  // 보기 단위(일·주·월)와 기준 날짜. 오늘 판정은 렌더 시점의 실제 날짜로 한다.
  const [view, setView] = useState<CalendarView>("month");
  // 앵커 = 보고 있는 기간을 정하는 하루. 월 보기는 그 달, 주 보기는 그 주, 일 보기는 그날.
  const [anchorISO, setAnchorISO] = useState(() => toISO(new Date()));

  const grid = useMemo(() => {
    const anchor = fromISO(anchorISO);
    const today = new Date();
    if (view === "day") return buildDayGrid(anchor, today);
    if (view === "week") return buildWeekGrid(anchor, today);
    return buildMonthGrid(anchor, today);
  }, [view, anchorISO]);

  // ◀▶ 이동 — 보기 단위만큼 앵커를 옮긴다 (일=1일, 주=7일, 월=한 달).
  // 함수형 업데이트로 항상 '현재' 앵커에서 옮긴다 — 드래그 중 가장자리 자동 전환은
  // 인터벌 콜백이 낡은 클로저를 붙잡으므로, prev를 읽지 않으면 같은 달만 반복 전환된다.
  function shiftPeriod(direction: -1 | 1) {
    setAnchorISO((prev) => {
      const anchor = fromISO(prev);
      if (view === "day") return toISO(addDays(anchor, direction));
      if (view === "week") return toISO(addDays(anchor, direction * 7));
      return toISO(
        new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1),
      );
    });
  }

  function goToday() {
    setAnchorISO(toISO(new Date()));
  }

  // "내 할일" 기준 — 작업 현황·사이드바와 같은 소유자 판정을 따른다.
  // 필터 바에서 담당자·프로젝트를 고르면 그 범위로 좁힌다 (뷰에만 적용).
  const myProjects = useMemo(
    () =>
      applyMyWorkFilter(groups, filter, user?.id),
    [groups, user?.id, filter],
  );

  // 드래그 중인 임시 상태 — 손을 뗄 때만 저장하고, 그 전까지는 화면만 미리 옮긴다.
  // 여러 주에 걸친 단계도 조각이 한꺼번에 따라오도록 소스 단계에서 갈아끼운다.
  const [preview, setPreview] = useState<{
    // taskDeltaDays: 단계 이동 미리보기에서 그 단계의 할일도 같은 일수만큼 함께 옮긴다
    stage?: { stageId: string; taskDeltaDays?: number } & StageDates;
    task?: { taskId: string; scheduledDate: string };
  } | null>(null);

  const previewBoards = useMemo(() => {
    if (!preview) return boards;
    const next: typeof boards = {};
    for (const [projectId, board] of Object.entries(boards)) {
      next[projectId] = {
        ...board,
        stages: board.stages.map((stage) => {
          const previewStage =
            preview.stage && stage.id === preview.stage.stageId
              ? preview.stage
              : null;
          const dates = previewStage
            ? { startDate: previewStage.startDate, endDate: previewStage.endDate }
            : null;
          let tasks = stage.tasks;
          // 단계 이동 미리보기: 그 단계의 할일도 같은 델타로 함께 옮겨 보여준다
          if (previewStage?.taskDeltaDays) {
            const shift = previewStage.taskDeltaDays;
            tasks = tasks.map((task) =>
              task.scheduledDate
                ? { ...task, scheduledDate: shiftISO(task.scheduledDate, shift) }
                : task,
            );
          }
          // 단일 할일 이동 미리보기
          if (preview.task) {
            tasks = tasks.map((task) =>
              task.id === preview.task!.taskId
                ? { ...task, scheduledDate: preview.task!.scheduledDate }
                : task,
            );
          }
          return dates ? { ...stage, ...dates, tasks } : { ...stage, tasks };
        }),
      };
    }
    return next;
  }, [boards, preview]);

  const source = useMemo(
    () => buildCalendarSource(grid, myProjects, previewBoards, unassigned, user?.id),
    [grid, myProjects, previewBoards, unassigned, user?.id],
  );

  /**
   * 드래그 결과 날짜와 대상 단계.
   * - 이동(move): 막대를 변형하지 않고 통째로 옮긴다. 할일이 함께 따라가므로(handleDrag)
   *   덮개가 늘 유지돼 clamp가 필요 없다.
   * - 시작/끝 조절: 할일은 제자리이므로 단계가 할일을 덮도록 clamp한다.
   */
  function nextStageDates(
    stageId: string,
    mode: DragMode,
    deltaDays: number,
  ): { projectId: string; stage: BoardStage; dates: StageDates } | null {
    for (const project of myProjects) {
      const stage = boards[project.id]?.stages.find(
        (candidate) => candidate.id === stageId,
      );
      if (!stage?.startDate) continue;
      const dragged = dragStageDates(
        mode,
        stage.startDate,
        stage.endDate,
        deltaDays,
      );
      // 단계 막대는 자유롭게 움직인다 — 할일을 덮어야 한다는 제약(clamp)을 두지 않는다.
      // 할일은 제자리에 남고, 단계 밖으로 밀려나도 프로젝트 바 안에는 유지된다(레이아웃 합집합).
      return { projectId: project.id, stage, dates: dragged };
    }
    return null;
  }

  /** 할일이 놓인 위치(프로젝트·단계)와 이동 후 예정일 */
  function nextTaskSchedule(taskId: string, deltaDays: number) {
    for (const project of myProjects) {
      for (const stage of boards[project.id]?.stages ?? []) {
        const task = stage.tasks.find((candidate) => candidate.id === taskId);
        if (!task?.scheduledDate) continue;
        // 명시적 union — 단계가 있으면 프로젝트도 있고, 미배정이면 둘 다 null이라는
        // 상관관계를 유지해, 아래에서 stage null을 걸러내면 projectId가 string으로 좁혀진다.
        return {
          projectId: project.id,
          stage,
          scheduledDate: shiftISO(task.scheduledDate, deltaDays),
        } as
          | { projectId: string; stage: BoardStage; scheduledDate: string }
          | { projectId: null; stage: null; scheduledDate: string };
      }
    }
    // 미배정 할일 — 소속 프로젝트·단계가 없다. 예정일만 옮긴다.
    const solo = unassigned.find((task) => task.id === taskId);
    if (solo?.scheduledDate) {
      return {
        projectId: null,
        stage: null,
        scheduledDate: shiftISO(solo.scheduledDate, deltaDays),
      };
    }
    return null;
  }

  /** 캘린더 칩의 체크박스 — 상세를 열지 않고 그 자리에서 완료를 토글한다 */
  function handleToggleTask(taskId: string) {
    for (const project of myProjects) {
      for (const stage of boards[project.id]?.stages ?? []) {
        if (stage.tasks.some((candidate) => candidate.id === taskId)) {
          boardActions.toggleTask(project.id, stage.id, taskId);
          return;
        }
      }
      // 단계에 속하지 않은 백로그 할일도 캘린더에 뜰 수 있다
      if (boards[project.id]?.backlog.some((task) => task.id === taskId)) {
        boardActions.toggleTask(project.id, null, taskId);
        return;
      }
    }
  }

  /**
   * 백로그에서 끌어온 할일을 날짜 칸에 떨어뜨렸을 때.
   * 그 날짜를 덮는 단계가 (같은 프로젝트에) 있으면 그 단계로 편입하고,
   * 없으면(미배정 할일 포함) 예정일만 잡는다.
   */
  function handleDropTask(taskId: string, date: string) {
    // 미배정 목록 먼저 — 프로젝트가 없으니 편입할 단계도 없다
    if (unassigned.some((task) => task.id === taskId)) {
      boardActions.updateTask(null, null, taskId, { scheduledDate: date });
      return;
    }
    for (const project of myProjects) {
      const board = boards[project.id];
      if (!board?.backlog.some((task) => task.id === taskId)) continue;
      const covering = board.stages.find(
        (stage) =>
          stage.startDate &&
          stage.startDate <= date &&
          (stage.endDate ?? stage.startDate) >= date,
      );
      if (covering) {
        boardActions.assignTask(
          project.id,
          taskId,
          project.id,
          covering.id,
          date,
        );
      } else {
        boardActions.updateTask(project.id, null, taskId, {
          scheduledDate: date,
        });
      }
      return;
    }
  }

  /**
   * 캘린더 칩을 백로그 패널로 끌어다 놓았을 때 — 예정일을 비워 캘린더에서 내리고
   * 백로그 목록으로 되돌린다. 미배정은 미배정인 채로, 프로젝트 소속(단계·백로그)이면
   * 그 프로젝트 백로그로.
   */
  function handleReturnToBacklog(taskId: string) {
    if (unassigned.some((task) => task.id === taskId)) {
      boardActions.returnToBacklog(null, taskId);
      return;
    }
    for (const project of myProjects) {
      const board = boards[project.id];
      if (!board) continue;
      const found =
        board.stages.some((stage) =>
          stage.tasks.some((task) => task.id === taskId),
        ) || board.backlog.some((task) => task.id === taskId);
      if (found) {
        boardActions.returnToBacklog(project.id, taskId);
        return;
      }
    }
  }

  function handleDrag(
    target: DragTarget,
    deltaDays: number,
    phase: "move" | "commit" | "cancel",
  ) {
    if (phase === "cancel") {
      setPreview(null);
      return;
    }

    if (target.kind === "task") {
      const next = nextTaskSchedule(target.taskId, deltaDays);
      if (!next) {
        setPreview(null);
        return;
      }
      // 미배정 할일은 단계가 없어 예정일만 옮긴다 (단계 커버 로직 없음).
      if (!next.stage) {
        if (phase === "move") {
          setPreview({
            task: { taskId: target.taskId, scheduledDate: next.scheduledDate },
          });
          return;
        }
        setPreview(null);
        boardActions.updateTask(null, null, target.taskId, {
          scheduledDate: next.scheduledDate,
        });
        return;
      }
      // 할일은 단계와 독립이다 — 단계 밖으로 나가도 단계를 늘리지 않는다.
      // (프로젝트 바는 레이아웃에서 단계+할일 합집합으로 계산되므로 여전히 덮는다)
      if (phase === "move") {
        setPreview({
          task: { taskId: target.taskId, scheduledDate: next.scheduledDate },
        });
        return;
      }
      setPreview(null);
      boardActions.updateTask(next.projectId, next.stage.id, target.taskId, {
        scheduledDate: next.scheduledDate,
      });
      return;
    }

    const next = nextStageDates(target.stageId, target.mode, deltaDays);
    if (!next) {
      setPreview(null);
      return;
    }
    // 이동일 때만 이 단계의 할일도 같은 델타로 함께 옮긴다 (타임라인과 동일 모델).
    const movesTasks = target.mode === "move";
    if (phase === "move") {
      setPreview({
        stage: {
          stageId: target.stageId,
          ...next.dates,
          taskDeltaDays: movesTasks ? deltaDays : undefined,
        },
      });
      return;
    }
    setPreview(null);
    boardActions.updateStage(next.projectId, target.stageId, {
      startDate: next.dates.startDate,
      endDate: next.dates.endDate,
    });
    if (movesTasks && deltaDays !== 0) {
      for (const task of next.stage.tasks) {
        if (!task.scheduledDate) continue;
        boardActions.updateTask(next.projectId, target.stageId, task.id, {
          scheduledDate: shiftISO(task.scheduledDate, deltaDays),
        });
      }
    }
  }

  const layouts = useMemo(
    () => buildWeekLayouts(source.overlays, grid.rowCount, grid.columns),
    [source.overlays, grid.rowCount, grid.columns],
  );

  const [detailStage, setDetailStage] = useState<{
    projectId: string;
    stageId: string;
  } | null>(null);
  // 할일 상세는 taskId만 있으면 된다 — TaskDetailOverlay가 스토어에서 위치를 찾는다
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const detailProject = detailStage
    ? myProjects.find((project) => project.id === detailStage.projectId)
    : undefined;

  const periodLabel =
    view === "day" ? "이 날" : view === "week" ? "이 주" : "이 달";

  return (
    <>
      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          aria-label="이전"
          onClick={() => shiftPeriod(-1)}
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ◀
        </button>
        <h2 className="min-w-[9ch] text-[15px] font-semibold tabular-nums">
          {grid.title}
        </h2>
        <button
          type="button"
          aria-label="다음"
          onClick={() => shiftPeriod(1)}
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ▶
        </button>
        <p className="text-xs text-muted-foreground">
          {periodLabel} {source.stageCount}건
        </p>
        <MyWorkCalendarToolbar
          view={view}
          onViewChange={setView}
          onToday={goToday}
          className="ml-auto"
        />
      </div>
      <MyWorkCalendar
        grid={grid}
        layouts={layouts}
        projects={source.projects}
        onOpenStage={(projectId, stageId) =>
          setDetailStage({ projectId, stageId })
        }
        onOpenTask={setDetailTaskId}
        onToggleTask={handleToggleTask}
        onDrag={handleDrag}
        onDropTask={handleDropTask}
        onReturnToBacklog={handleReturnToBacklog}
        onAddTask={(projectId, stageId, date, name) =>
          // 빈 칸(projectId=null) 클릭이면 내 공통 작업(기본 프로젝트)으로 — 아직 로드
          // 전이면 null(미배정)로 폴백해 다음 로드에 이관된다.
          boardActions.addScheduledTask(
            projectId ?? defaultProjectIdOf(groups, user?.id),
            name,
            date,
            user?.id,
            stageId,
          )
        }
        onEdgeTurn={shiftPeriod}
      />
      {detailStage && (
        <StageDetailOverlay
          projectId={detailStage.projectId}
          projectName={detailProject?.name ?? ""}
          projectColor={detailProject?.color ?? "#71717a"}
          stageId={detailStage.stageId}
          onOpenChange={(open) => {
            if (!open) setDetailStage(null);
          }}
        />
      )}
      <TaskDetailOverlay
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
      />
    </>
  );
}
