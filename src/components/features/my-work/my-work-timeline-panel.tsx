"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useSession } from "@/components/features/auth/session-context";
import { useProjectStore } from "@/components/features/projects/project-store";
import {
  applyMyWorkFilter,
  useMyWorkFilter,
} from "@/components/features/my-work/my-work-filter-store";
import { isMyTask } from "@/components/features/my-work/my-work-scope";
import {
  boardActions,
  useBoardState,
} from "@/components/features/projects/board-store";
import { taskTone } from "@/components/features/projects/project-palette";
import {
  barRange,
  clampStageToTasks,
  dayOffset,
  formatShort,
  shiftISO,
  type StageDates,
} from "@/components/features/projects/roadmap-utils";
import { RoadmapBar } from "@/components/features/projects/roadmap-bar";
import {
  RANGE_OPTIONS,
  boundsOfStages,
  buildTimeline,
  formatPeriod,
  todayISO,
  type RoadmapRange,
  type RoadmapTimeline,
} from "@/components/features/projects/roadmap-window";
import { TaskDetailOverlay } from "@/components/features/projects/task-detail-overlay";
import { StageDetailOverlay } from "@/components/features/projects/stage-detail-overlay";
import type { BoardStage, BoardTask, Project } from "@/types/workspace";

// 내 할일 타임라인 — Figma "My Work Layout — Timeline"(199:1139).
// 표 구조(라벨 컬럼 + 기간 축 + 오늘선)와 막대는 작업 현황 로드맵과 같은
// 컴포넌트(buildTimeline·RoadmapBar)를 써서 두 화면의 조작감을 맞춘다.

const LABEL_WIDTH = 200;
/** 스크롤 위치를 잡을 때 오늘을 왼쪽에서 이만큼 떨어뜨린다 (로드맵과 동일) */
const TODAY_LEFT_INSET = 120;
/** 하루짜리 작업 막대의 최소 폭 — 날짜 글자를 이만큼 오른쪽에 붙인다 */
const MARKER_WIDTH = 30;

type TimelineTask = { task: BoardTask; stage: BoardStage | null };

export function MyWorkTimelinePanel() {
  const { user } = useSession();
  const filter = useMyWorkFilter();
  const { groups } = useProjectStore();
  const boards = useBoardState();
  const [range, setRange] = useState<RoadmapRange>("주");
  const [today] = useState(todayISO);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [detailStageId, setDetailStageId] = useState<string | null>(null);

  // 캘린더 뷰와 같은 "내 할일" 기준 — 내가 소유한 프로젝트.
  // 필터 바 선택이 있으면 그 범위로 좁힌다 (캘린더와 같은 규칙).
  const myProjects = useMemo(
    () =>
      applyMyWorkFilter(groups, filter, user?.id),
    [groups, user?.id, filter],
  );

  const timeline = useMemo(
    () =>
      buildTimeline(
        range,
        today,
        boundsOfStages(
          myProjects.flatMap((project) => boards[project.id]?.stages ?? []),
        ),
      ),
    [range, today, myProjects, boards],
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollToToday = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const element = scrollRef.current;
      if (!element || timeline.todayOffset === null) return;
      element.scrollTo({
        left: Math.max(
          0,
          timeline.todayOffset * timeline.dayWidth - TODAY_LEFT_INSET,
        ),
        behavior,
      });
    },
    [timeline.todayOffset, timeline.dayWidth],
  );
  // 마운트·범위 변경 시 오늘 위치로 맞춘다 (로드맵과 같은 ref 콜백 방식)
  const attachScroll = useCallback(
    (element: HTMLDivElement | null) => {
      scrollRef.current = element;
      if (element && timeline.todayOffset !== null) {
        element.scrollLeft = Math.max(
          0,
          timeline.todayOffset * timeline.dayWidth - TODAY_LEFT_INSET,
        );
      }
    },
    [timeline.todayOffset, timeline.dayWidth],
  );

  // 단계 상세 오버레이는 프로젝트 이름·색을 함께 받는다 — 열린 단계의 소속을 찾는다.
  // 프로젝트 수가 적어 매 렌더 훑어도 부담이 없다 (useMemo는 컴파일러가 처리).
  const detailStage = detailStageId
    ? myProjects.find((project) =>
        boards[project.id]?.stages.some((stage) => stage.id === detailStageId),
      )
    : undefined;

  /**
   * 단계 막대 드래그.
   * 통째 이동(양 끝이 같은 일수만큼 밀림)이면 그 단계의 할일 예정일도 함께 옮겨
   * 블록이 통째로 움직이게 한다. 양 끝 손잡이로 기간만 바꾼 경우는 단계만 바꾼다.
   */
  function moveStage(
    projectId: string,
    stage: BoardStage,
    patch: StageDates,
  ) {
    boardActions.updateStage(projectId, stage.id, patch);
    if (!stage.startDate) return;
    const startDelta = dayOffset(patch.startDate, stage.startDate);
    if (startDelta === 0) return;
    const endDelta =
      stage.endDate && patch.endDate
        ? dayOffset(patch.endDate, stage.endDate)
        : startDelta;
    if (endDelta !== startDelta) return; // 기간 조절이라 할일은 건드리지 않는다
    for (const task of stage.tasks) {
      if (!task.scheduledDate) continue;
      boardActions.updateTask(projectId, stage.id, task.id, {
        scheduledDate: shiftISO(task.scheduledDate, startDelta),
      });
    }
  }

  /** 프로젝트 막대 드래그 — 소속 단계와 할일 전부를 같은 일수만큼 옮긴다 */
  function moveProject(projectId: string, delta: number) {
    if (delta === 0) return;
    const board = boards[projectId];
    if (!board) return;
    for (const stage of board.stages) {
      if (stage.startDate) {
        boardActions.updateStage(projectId, stage.id, {
          startDate: shiftISO(stage.startDate, delta),
          endDate: stage.endDate ? shiftISO(stage.endDate, delta) : undefined,
        });
      }
      for (const task of stage.tasks) {
        if (!task.scheduledDate) continue;
        boardActions.updateTask(projectId, stage.id, task.id, {
          scheduledDate: shiftISO(task.scheduledDate, delta),
        });
      }
    }
    for (const task of board.backlog) {
      if (!task.scheduledDate) continue;
      boardActions.updateTask(projectId, null, task.id, {
        scheduledDate: shiftISO(task.scheduledDate, delta),
      });
    }
  }

  /** 예정일 변경 — 캘린더 드래그와 같은 규칙으로 단계가 늘어나 덮는다 */
  function moveTask(
    projectId: string,
    entry: TimelineTask,
    scheduledDate: string,
  ) {
    boardActions.updateTask(projectId, entry.stage?.id ?? null, entry.task.id, {
      scheduledDate,
    });
    const stage = entry.stage;
    if (!stage?.startDate) return;
    const stretched = clampStageToTasks(
      { startDate: stage.startDate, endDate: stage.endDate },
      { min: scheduledDate, max: scheduledDate },
    );
    if (
      stretched.startDate !== stage.startDate ||
      stretched.endDate !== stage.endDate
    ) {
      boardActions.updateStage(projectId, stage.id, stretched);
    }
  }

  return (
    <section className="w-full overflow-hidden rounded-[12px] border bg-background shadow-[0px_1px_3px_0px_rgba(0,0,0,0.05)]">
      <header className="flex items-center justify-between gap-4 py-2.5 pl-4 pr-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[13.5px] font-semibold">타임라인</h2>
          <p className="text-[11.5px] text-muted-foreground">
            {formatPeriod(timeline)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollToToday()}
            className="rounded-[6px] border px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            오늘
          </button>
          <div className="flex items-center gap-0.5 rounded-[8px] bg-muted p-[3px]">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={option === range}
                onClick={() => setRange(option)}
                className={cn(
                  "rounded-[6px] px-[9px] py-[3px] text-[11px] font-medium transition-colors",
                  option === range
                    ? "bg-background text-foreground shadow-[0px_1px_2px_0px_rgba(0,0,0,0.08)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div
        ref={attachScroll}
        className="overflow-x-auto overscroll-x-contain border-t"
      >
        <div className="relative" style={{ width: LABEL_WIDTH + timeline.width }}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0"
            style={{ left: LABEL_WIDTH, width: timeline.width }}
          >
            {timeline.ticks.map((tick) => (
              <div
                key={tick.key}
                className={cn(
                  "absolute inset-y-0 border-l",
                  tick.yearStart
                    ? "border-muted-foreground/40"
                    : "border-border",
                )}
                style={{ left: tick.offsetDays * timeline.dayWidth }}
              />
            ))}
            {timeline.todayOffset !== null && (
              <div
                className="absolute inset-y-0 w-[2px] bg-primary"
                style={{ left: timeline.todayOffset * timeline.dayWidth }}
              />
            )}
          </div>
          <div className="sticky top-0 z-30 flex h-[26px] items-stretch bg-background text-[10.5px] font-medium text-muted-foreground">
            <div
              className="sticky left-0 z-10 flex shrink-0 items-center border-r bg-background pl-4"
              style={{ width: LABEL_WIDTH }}
            >
              프로젝트 · 단계 · 할일
            </div>
            <div className="relative shrink-0" style={{ width: timeline.width }}>
              {timeline.ticks.map((tick, index) => {
                const showYear =
                  index === 0 ||
                  timeline.ticks[index - 1].year !== tick.year ||
                  tick.yearStart;
                return (
                  <span
                    key={tick.key}
                    className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-1.5"
                    style={{ left: tick.offsetDays * timeline.dayWidth }}
                  >
                    {showYear && (
                      <span className="mr-1 text-foreground">{tick.year}</span>
                    )}
                    {tick.label}
                  </span>
                );
              })}
            </div>
          </div>
          {myProjects.length === 0 && (
            <p className="border-t px-4 py-6 text-center text-xs text-muted-foreground">
              내가 작업자인 프로젝트가 없습니다.
            </p>
          )}
          {myProjects.map((project) => {
            const board = boards[project.id];
            const stages = board?.stages ?? [];
            // 백로그는 내 작업이므로 담당자가 나인 것만 (단계 할일은 무관)
            const backlog = (board?.backlog ?? []).filter((task) =>
              isMyTask(task, user?.id),
            );
            const entries: TimelineTask[] = [
              ...stages.flatMap((stage) =>
                stage.tasks.map((task) => ({ task, stage })),
              ),
              ...backlog.map((task) => ({ task, stage: null })),
            ];
            const doneCount = entries.filter(
              (entry) => entry.task.done,
            ).length;
            const percent =
              entries.length === 0
                ? 0
                : Math.round((doneCount / entries.length) * 100);
            // 프로젝트 막대는 단계 기간과 할일 예정일을 모두 덮는 범위
            const marks = [
              ...stages.flatMap((stage) =>
                stage.startDate
                  ? [stage.startDate, stage.endDate ?? stage.startDate]
                  : [],
              ),
              ...entries.flatMap((entry) =>
                entry.task.scheduledDate ? [entry.task.scheduledDate] : [],
              ),
            ].sort();
            return (
              <div key={project.id}>
                <div className="flex h-[26px] items-stretch border-t bg-muted/40">
                  <div
                    className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-r bg-muted pl-4 pr-2.5"
                    style={{ width: LABEL_WIDTH }}
                  >
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                      {project.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      · {entries.length}
                    </span>
                  </div>
                  <div
                    className="relative shrink-0"
                    style={{ width: timeline.width }}
                  >
                    {marks.length > 0 && (
                      // 기간이 단계·할일에서 나온 파생값이라 양 끝 조절은 막고
                      // 통째 이동만 허용한다 (소속 단계·할일이 같이 움직인다)
                      <RoadmapBar
                        timeline={timeline}
                        color={project.color}
                        startDate={marks[0]}
                        endDate={marks[marks.length - 1]}
                        resizable={false}
                        onCommit={(patch) =>
                          moveProject(
                            project.id,
                            dayOffset(patch.startDate, marks[0]),
                          )
                        }
                        title={`${project.name} — 끌면 단계·할일이 함께 이동`}
                        label={`전체 ${percent}%`}
                      />
                    )}
                  </div>
                </div>
                {stages.map((stage) => {
                  const stageDone = stage.tasks.filter(
                    (task) => task.done,
                  ).length;
                  return (
                    <div key={stage.id}>
                      {/* 단계 행 — 프로젝트 상세 로드맵의 단계 행과 같은 구성
                          (색 점 + 이름 + 완료/전체 + 기간 막대) */}
                      <div className="flex h-[26px] items-stretch border-t">
                        <div
                          className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-r bg-background pl-7 pr-2.5"
                          style={{ width: LABEL_WIDTH }}
                        >
                          <span
                            aria-hidden
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          <button
                            type="button"
                            onClick={() => setDetailStageId(stage.id)}
                            className="min-w-0 flex-1 truncate text-left text-[11.5px] font-medium underline-offset-2 hover:underline"
                          >
                            {stage.name}
                          </button>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {stageDone}/{stage.tasks.length}
                          </span>
                        </div>
                        <div
                          className="relative shrink-0"
                          style={{ width: timeline.width }}
                        >
                          {stage.startDate && (
                            <RoadmapBar
                              timeline={timeline}
                              color={stage.color}
                              startDate={stage.startDate}
                              endDate={stage.endDate}
                              onClick={() => setDetailStageId(stage.id)}
                              onCommit={(patch) =>
                                moveStage(project.id, stage, patch)
                              }
                              title={`${stage.name} — 클릭하면 단계 상세, 끌면 할일까지 함께 이동`}
                              label={stage.name}
                            />
                          )}
                        </div>
                      </div>
                      {stage.tasks.map((task) => (
                        <TimelineTaskRow
                          key={task.id}
                          project={project}
                          entry={{ task, stage }}
                          timeline={timeline}
                          onOpen={() => setDetailTaskId(task.id)}
                          onMove={(date) =>
                            moveTask(project.id, { task, stage }, date)
                          }
                        />
                      ))}
                    </div>
                  );
                })}
                {backlog.length > 0 && (
                  <>
                    {/* 단계에 속하지 않은 할일 — 단계 행과 같은 층에 묶는다 */}
                    <div className="flex h-[26px] items-stretch border-t">
                      <div
                        className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-r bg-background pl-7 pr-2.5"
                        style={{ width: LABEL_WIDTH }}
                      >
                        <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-muted-foreground">
                          백로그
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {backlog.filter((task) => task.done).length}/
                          {backlog.length}
                        </span>
                      </div>
                      <div
                        className="relative shrink-0"
                        style={{ width: timeline.width }}
                      />
                    </div>
                    {backlog.map((task) => (
                      <TimelineTaskRow
                        key={task.id}
                        project={project}
                        entry={{ task, stage: null }}
                        timeline={timeline}
                        onOpen={() => setDetailTaskId(task.id)}
                        onMove={(date) =>
                          moveTask(project.id, { task, stage: null }, date)
                        }
                      />
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <TaskDetailOverlay
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
      />
      <StageDetailOverlay
        projectId={detailStage?.id ?? ""}
        projectName={detailStage?.name ?? ""}
        projectColor={detailStage?.color ?? "#71717a"}
        stageId={detailStageId}
        onOpenChange={(open) => {
          if (!open) setDetailStageId(null);
        }}
      />
    </section>
  );
}

/** 할일 행 — 단계 아래·백로그 아래 양쪽에서 같은 모양으로 쓴다 */
function TimelineTaskRow({
  project,
  entry,
  timeline,
  onOpen,
  onMove,
}: {
  project: Project;
  entry: TimelineTask;
  timeline: RoadmapTimeline;
  onOpen: () => void;
  onMove: (scheduledDate: string) => void;
}) {
  const { task, stage } = entry;
  const color = stage ? taskTone(stage.color) : project.color;
  return (
    <div className="flex h-[26px] items-stretch border-t">
      <div
        className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r bg-background pl-10 pr-2.5"
        style={{ width: LABEL_WIDTH }}
      >
        <Checkbox
          aria-label={`${task.name} 완료`}
          checked={task.done}
          onCheckedChange={() =>
            boardActions.toggleTask(project.id, stage?.id ?? null, task.id)
          }
          className="size-3.5 rounded-[4px] border-primary"
        />
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "min-w-0 flex-1 truncate text-left text-xs underline-offset-2 hover:underline",
            task.done && "text-muted-foreground line-through",
          )}
        >
          {task.name}
        </button>
      </div>
      <div className="relative shrink-0" style={{ width: timeline.width }}>
        {task.scheduledDate && (
          <>
            {/* 하루짜리 막대는 좁아 글자가 잘린다 — 디자인처럼
                날짜는 막대 오른쪽에 따로 적는다 */}
            <RoadmapBar
              timeline={timeline}
              color={color}
              startDate={task.scheduledDate}
              endDate={task.scheduledDate}
              onClick={onOpen}
              onCommit={(patch) => onMove(patch.startDate)}
              title={`${task.name} — 클릭하면 할일 상세, 끌면 예정일 이동`}
              label=""
            />
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-1 flex h-[18px] items-center whitespace-nowrap text-[10.5px] font-medium",
                task.done && "text-muted-foreground",
              )}
              style={{
                left:
                  barRange(
                    timeline.start,
                    timeline.days,
                    task.scheduledDate,
                    task.scheduledDate,
                  ).startDay *
                    timeline.dayWidth +
                  MARKER_WIDTH,
                color: task.done ? undefined : color,
              }}
            >
              {formatShort(task.scheduledDate)}
              {task.done && " ✓"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
