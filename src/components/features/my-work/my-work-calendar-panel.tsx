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
  clampStageToTasks,
  dragStageDates,
  shiftISO,
  taskDateRange,
  type DragMode,
  type StageDates,
} from "@/components/features/projects/roadmap-utils";
import { StageDetailOverlay } from "@/components/features/projects/stage-detail-overlay";
import { TaskDetailOverlay } from "@/components/features/projects/task-detail-overlay";
import {
  MyWorkCalendar,
  type DragTarget,
} from "@/components/features/my-work/my-work-calendar";
import { buildMonthGrid } from "@/components/features/my-work/my-work-month";
import { buildCalendarSource } from "@/components/features/my-work/my-work-calendar-source";
import { buildWeekLayouts } from "@/components/features/my-work/my-work-calendar-layout";

export function MyWorkCalendarPanel() {
  const { user } = useSession();
  const { groups } = useProjectStore();
  const boards = useBoardState();
  const unassigned = useUnassignedTasks();

  // 보고 있는 달의 1일. 오늘 판정은 렌더 시점의 실제 날짜로 한다.
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const grid = useMemo(
    () => buildMonthGrid(monthAnchor, new Date()),
    [monthAnchor],
  );

  // "내 할일" 기준 — 작업 현황·사이드바와 같은 소유자 판정을 따른다.
  const myProjects = useMemo(
    () =>
      groups
        .flatMap((group) => group.projects)
        .filter((project) => project.ownerId === user?.id),
    [groups, user?.id],
  );

  // 드래그 중인 임시 상태 — 손을 뗄 때만 저장하고, 그 전까지는 화면만 미리 옮긴다.
  // 여러 주에 걸친 단계도 조각이 한꺼번에 따라오도록 소스 단계에서 갈아끼운다.
  const [preview, setPreview] = useState<{
    stage?: { stageId: string } & StageDates;
    task?: { taskId: string; scheduledDate: string };
  } | null>(null);

  const previewBoards = useMemo(() => {
    if (!preview) return boards;
    const next: typeof boards = {};
    for (const [projectId, board] of Object.entries(boards)) {
      next[projectId] = {
        ...board,
        stages: board.stages.map((stage) => {
          const dates =
            preview.stage && stage.id === preview.stage.stageId
              ? {
                  startDate: preview.stage.startDate,
                  endDate: preview.stage.endDate,
                }
              : null;
          const tasks = preview.task
            ? stage.tasks.map((task) =>
                task.id === preview.task!.taskId
                  ? { ...task, scheduledDate: preview.task!.scheduledDate }
                  : task,
              )
            : stage.tasks;
          return dates ? { ...stage, ...dates, tasks } : { ...stage, tasks };
        }),
      };
    }
    return next;
  }, [boards, preview]);

  const source = useMemo(
    () => buildCalendarSource(grid, myProjects, previewBoards, unassigned),
    [grid, myProjects, previewBoards, unassigned],
  );

  /** 드래그 결과 날짜 — 자기 할일을 항상 덮도록 늘려서 돌려준다 */
  function nextStageDates(
    stageId: string,
    mode: DragMode,
    deltaDays: number,
  ): { projectId: string; dates: StageDates } | null {
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
      return {
        projectId: project.id,
        dates: clampStageToTasks(dragged, taskDateRange(stage.tasks)),
      };
    }
    return null;
  }

  /** 할일이 놓인 위치(프로젝트·단계)와 이동 후 예정일 */
  function nextTaskSchedule(taskId: string, deltaDays: number) {
    for (const project of myProjects) {
      for (const stage of boards[project.id]?.stages ?? []) {
        const task = stage.tasks.find((candidate) => candidate.id === taskId);
        if (!task?.scheduledDate) continue;
        return {
          projectId: project.id,
          stage,
          scheduledDate: shiftISO(task.scheduledDate, deltaDays),
        };
      }
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
      // 할일이 단계 밖으로 나가면 단계가 늘어나 덮는다 (하위를 커버하는 규칙)
      const stretched = clampStageToTasks(
        { startDate: next.stage.startDate!, endDate: next.stage.endDate },
        { min: next.scheduledDate, max: next.scheduledDate },
      );
      if (phase === "move") {
        setPreview({
          task: { taskId: target.taskId, scheduledDate: next.scheduledDate },
          stage: { stageId: next.stage.id, ...stretched },
        });
        return;
      }
      setPreview(null);
      boardActions.updateTask(next.projectId, next.stage.id, target.taskId, {
        scheduledDate: next.scheduledDate,
      });
      if (
        stretched.startDate !== next.stage.startDate ||
        stretched.endDate !== next.stage.endDate
      ) {
        boardActions.updateStage(next.projectId, next.stage.id, stretched);
      }
      return;
    }

    const next = nextStageDates(target.stageId, target.mode, deltaDays);
    if (!next) {
      setPreview(null);
      return;
    }
    if (phase === "move") {
      setPreview({ stage: { stageId: target.stageId, ...next.dates } });
      return;
    }
    setPreview(null);
    boardActions.updateStage(next.projectId, target.stageId, {
      startDate: next.dates.startDate,
      endDate: next.dates.endDate,
    });
  }

  const layouts = useMemo(
    () => buildWeekLayouts(source.overlays, grid.weekCount),
    [source.overlays, grid.weekCount],
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

  function shiftMonth(amount: number) {
    setMonthAnchor(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + amount, 1),
    );
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => shiftMonth(-1)}
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ◀
        </button>
        {/* 월 숫자는 2자리 고정폭 슬롯에 넣는다 — 1자리 달(7월)에도 제목 폭이 같아야
            양옆 화살표가 달을 넘길 때마다 밀리지 않는다 */}
        <h2 className="text-[15px] font-semibold tabular-nums">
          {grid.year}년{" "}
          <span className="inline-block w-[2ch] text-right">
            {grid.month + 1}
          </span>
          월
        </h2>
        <button
          type="button"
          aria-label="다음 달"
          onClick={() => shiftMonth(1)}
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ▶
        </button>
        <p className="text-xs text-muted-foreground">
          이 달 {source.stageCount}건
        </p>
        {/* ml-auto는 제거된 기간 세그먼트가 갖고 있던 우측 정렬 역할을 이어받은 것 */}
        <button
          type="button"
          onClick={() => {
            const today = new Date();
            setMonthAnchor(new Date(today.getFullYear(), today.getMonth(), 1));
          }}
          className="ml-auto rounded-[8px] border px-2.5 py-[5px] text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          오늘
        </button>
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
