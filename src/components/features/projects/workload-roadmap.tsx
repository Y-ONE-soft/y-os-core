"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Project } from "@/components/features/projects/project-store";
import {
  boardActions,
  useBoardState,
} from "@/components/features/projects/board-store";
import {
  barRange,
  dragStageDates,
  formatShort,
  hexToRgba,
  type DragMode,
  type StageDates,
} from "@/components/features/projects/roadmap-utils";
import {
  RANGE_OPTIONS,
  buildTimeline,
  formatPeriod,
  todayISO,
  type RoadmapRange,
  type RoadmapTimeline,
} from "@/components/features/projects/roadmap-window";

const LABEL_WIDTH = 200;
/** 스크롤 위치를 잡을 때 오늘을 왼쪽에서 이만큼 떨어뜨린다 */
const TODAY_LEFT_INSET = 120;
/** 클릭과 드래그를 가르는 이동량(px) — 이보다 덜 움직이면 클릭으로 본다 */
const DRAG_THRESHOLD = 3;
/** 막대 양 끝 리사이즈 손잡이 폭(px) */
const HANDLE_WIDTH = 6;

export type RoadmapSection = {
  key: string;
  /** null이면 그룹 헤더 행 없이 플랫하게 표시 (스탭 뷰) */
  groupName: string | null;
  projects: Project[];
};

function Bar({
  timeline,
  color,
  startDate,
  endDate,
  label,
  badge,
  onClick,
  title,
  onCommit,
}: {
  timeline: RoadmapTimeline;
  color: string;
  startDate: string;
  endDate?: string;
  /** 함수를 넘기면 드래그 미리보기 날짜로 라벨을 다시 그린다 */
  label: string | ((start: string, end?: string) => string);
  /** 단계 순번 — 내 작업 캘린더와 같은 원형 배지로 표시 */
  badge?: number;
  onClick?: () => void;
  title?: string;
  /** 드래그로 기간이 바뀌면 호출 — 넘기지 않으면 드래그 비활성 */
  onCommit?: (patch: StageDates) => void;
}) {
  const rootRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ mode: DragMode; x: number; moved: boolean } | null>(
    null,
  );
  // 드래그였다면 뒤이어 오는 click(단계 상세 열기)을 한 번 삼킨다
  const draggedRef = useRef(false);
  // 드래그 중 미리보기 — 손을 뗄 때까지 서버로 보내지 않는다
  const [draft, setDraft] = useState<StageDates | null>(null);

  const draggable = Boolean(onCommit);

  function computeDraft(mode: DragMode, delta: number) {
    return dragStageDates(mode, startDate, endDate, delta);
  }

  function beginDrag(mode: DragMode, event: React.PointerEvent) {
    if (!draggable) return;
    // 손잡이에서 시작한 드래그가 막대 본체의 이동 드래그로 번지지 않게 한다
    event.stopPropagation();
    rootRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = { mode, x: event.clientX, moved: false };
  }

  function finishDrag(event: React.PointerEvent, commit: boolean) {
    const drag = dragRef.current;
    dragRef.current = null;
    setDraft(null);
    if (!drag) return;
    if (rootRef.current?.hasPointerCapture(event.pointerId)) {
      rootRef.current.releasePointerCapture(event.pointerId);
    }
    if (!drag.moved) return;
    draggedRef.current = true;
    if (!commit) return;
    // 미리보기 state가 아니라 최종 좌표에서 다시 계산한다 (stale 방지)
    const delta = Math.round((event.clientX - drag.x) / timeline.dayWidth);
    if (delta === 0) return;
    onCommit?.(computeDraft(drag.mode, delta));
  }

  function handleBodyPointerDown(event: React.PointerEvent) {
    beginDrag("move", event);
  }

  function handleStartHandlePointerDown(event: React.PointerEvent) {
    beginDrag("start", event);
  }

  function handleEndHandlePointerDown(event: React.PointerEvent) {
    beginDrag("end", event);
  }

  function handlePointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
    drag.moved = true;
    setDraft(computeDraft(drag.mode, Math.round(dx / timeline.dayWidth)));
  }

  function handlePointerUp(event: React.PointerEvent) {
    finishDrag(event, true);
  }

  function handlePointerCancel(event: React.PointerEvent) {
    finishDrag(event, false);
  }

  const handleClick = () => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    onClick?.();
  };

  const shownStart = draft ? draft.startDate : startDate;
  const shownEnd = draft ? draft.endDate : endDate;
  const { startDay, days } = barRange(
    timeline.start,
    timeline.days,
    shownStart,
    shownEnd,
  );
  if (days <= 0) return null;
  const style = {
    left: startDay * timeline.dayWidth,
    // 배지가 있으면 배지(11) + 여백이 잘리지 않을 만큼 최소폭을 넓힌다
    width: Math.max(days * timeline.dayWidth, badge === undefined ? 26 : 32),
    backgroundColor: hexToRgba(color, 0.12),
    borderColor: hexToRgba(color, 0.8),
  };
  const className = cn(
    "absolute top-1 flex h-[18px] items-center overflow-hidden rounded-[6px] border text-left",
    badge === undefined ? "pl-2" : "gap-1 pl-1 pr-1.5",
    // touch-none: 터치로 막대를 끌 때 가로 스크롤이 같이 먹지 않게 한다
    draggable && "cursor-grab touch-none select-none active:cursor-grabbing",
    draft && "z-10 shadow-sm",
  );
  const handles = draggable && (
    <>
      <span
        aria-hidden
        onPointerDown={handleStartHandlePointerDown}
        className="absolute inset-y-0 left-0 cursor-ew-resize"
        style={{ width: HANDLE_WIDTH }}
      />
      <span
        aria-hidden
        onPointerDown={handleEndHandlePointerDown}
        className="absolute inset-y-0 right-0 cursor-ew-resize"
        style={{ width: HANDLE_WIDTH }}
      />
    </>
  );
  const dragProps = draggable
    ? {
        onPointerDown: handleBodyPointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerCancel,
      }
    : {};
  const content = (
    <>
      {badge !== undefined && (
        <span
          aria-hidden
          className="flex size-[11px] shrink-0 items-center justify-center rounded-full text-[7.5px] font-medium text-white"
          style={{ backgroundColor: color }}
        >
          {badge}
        </span>
      )}
      <span
        className="whitespace-nowrap text-[10.5px] font-medium"
        style={{ color }}
      >
        {typeof label === "function" ? label(shownStart, shownEnd) : label}
      </span>
    </>
  );

  const setRoot = (node: HTMLElement | null) => {
    rootRef.current = node;
  };

  if (!onClick) {
    return (
      <div ref={setRoot} className={className} style={style} {...dragProps}>
        {content}
        {handles}
      </div>
    );
  }
  return (
    <button
      ref={setRoot}
      type="button"
      onClick={handleClick}
      title={title}
      className={cn(className, "transition-shadow hover:shadow-sm")}
      style={style}
      {...dragProps}
    >
      {content}
      {handles}
    </button>
  );
}

export function WorkloadRoadmap({
  sections,
  onOpenStage,
}: {
  sections: RoadmapSection[];
  onOpenStage?: (projectId: string, stageId: string) => void;
}) {
  const boardState = useBoardState();
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const [range, setRange] = useState<RoadmapRange>("주");
  // 세션 로딩 이후 클라이언트에서만 첫 렌더되므로 지연 초기화가 안전하다
  const [today] = useState(todayISO);

  const timeline = buildTimeline(range, today);
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

  // 마운트·범위 변경 시 오늘 위치로 맞춘다 (ref 콜백이라 effect 없이 처리)
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

  const toggleSection = (key: string) =>
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="w-full overflow-hidden rounded-[12px] border bg-background shadow-[0px_1px_3px_0px_rgba(0,0,0,0.05)]">
      <header className="flex items-center justify-between gap-4 py-2.5 pl-4 pr-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="shrink-0 text-[13.5px] font-semibold">로드맵</h2>
          <p className="truncate text-[11.5px] text-muted-foreground">
            {formatPeriod(timeline)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-muted p-[3px]">
          <button
            type="button"
            onClick={() => scrollToToday()}
            className="rounded-full px-[9px] py-[3px] text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            오늘
          </button>
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              aria-pressed={option === range}
              className={cn(
                "rounded-full px-[9px] py-[3px] text-[11px] font-medium transition-colors",
                option === range
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </header>
      <div
        ref={attachScroll}
        className="overflow-x-auto overscroll-x-contain border-t"
      >
        <div
          className="relative"
          style={{ width: LABEL_WIDTH + timeline.width }}
        >
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
                  tick.yearStart ? "border-muted-foreground/40" : "border-border",
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
              프로젝트 · 단계
            </div>
            <div
              className="relative shrink-0"
              style={{ width: timeline.width }}
            >
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
          {sections.map((section) => {
            const collapsed = collapsedKeys.has(section.key);
            return (
              <div key={section.key}>
                {section.groupName !== null && (
                  <div className="flex h-7 items-stretch border-t bg-muted/50">
                    <button
                      type="button"
                      onClick={() => toggleSection(section.key)}
                      aria-expanded={!collapsed}
                      className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-r bg-muted pl-4 pr-2.5 text-left"
                      style={{ width: LABEL_WIDTH }}
                    >
                      {collapsed ? (
                        <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                        {section.groupName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        · {section.projects.length}
                      </span>
                    </button>
                  </div>
                )}
                {!collapsed &&
                  section.projects.map((project) => {
                    const board = boardState[project.id];
                    const stages = board?.stages ?? [];
                    const allTasks = stages.flatMap((stage) => stage.tasks);
                    const doneAll = allTasks.filter((task) => task.done).length;
                    const overallPercent =
                      allTasks.length === 0
                        ? 0
                        : Math.round((doneAll / allTasks.length) * 100);
                    const dated = stages.filter((stage) => stage.startDate);
                    const projectStart = dated.length
                      ? dated.map((stage) => stage.startDate!).sort()[0]
                      : null;
                    const ends = dated
                      .map((stage) => stage.endDate ?? stage.startDate!)
                      .sort();
                    const projectEnd = ends.length
                      ? ends[ends.length - 1]
                      : null;
                    return (
                      <div key={project.id}>
                        <div className="flex h-[26px] items-stretch border-t">
                          <div
                            className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-r bg-background pl-4 pr-2.5"
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
                          </div>
                          <div
                            className="relative shrink-0"
                            style={{ width: timeline.width }}
                          >
                            {projectStart && (
                              <Bar
                                timeline={timeline}
                                color={project.color}
                                startDate={projectStart}
                                endDate={projectEnd ?? undefined}
                                label={`전체 ${overallPercent}%`}
                              />
                            )}
                          </div>
                        </div>
                        {stages.map((stage, stageIndex) => {
                          const done = stage.tasks.filter(
                            (task) => task.done,
                          ).length;
                          const total = stage.tasks.length;
                          const stagePercent =
                            total === 0 ? 0 : Math.round((done / total) * 100);
                          const showBar = Boolean(
                            stage.showDeadline && stage.startDate,
                          );
                          const openStage = onOpenStage
                            ? () => onOpenStage(project.id, stage.id)
                            : undefined;
                          return (
                            <div
                              key={stage.id}
                              className="flex h-[26px] items-stretch border-t"
                            >
                              <div
                                className="sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-r bg-background pl-7 pr-2.5"
                                style={{ width: LABEL_WIDTH }}
                              >
                                <span
                                  aria-hidden
                                  className="size-1.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: stage.color }}
                                />
                                {openStage ? (
                                  <button
                                    type="button"
                                    onClick={openStage}
                                    className="min-w-0 flex-1 truncate text-left text-xs transition-colors hover:text-primary/80 hover:underline"
                                  >
                                    {stage.name}
                                  </button>
                                ) : (
                                  <span className="min-w-0 flex-1 truncate text-xs">
                                    {stage.name}
                                  </span>
                                )}
                                <span className="text-[11px] text-muted-foreground">
                                  {done}/{total}
                                </span>
                              </div>
                              <div
                                className="relative shrink-0"
                                style={{ width: timeline.width }}
                              >
                                {showBar && (
                                  <Bar
                                    timeline={timeline}
                                    color={stage.color}
                                    startDate={stage.startDate!}
                                    endDate={stage.endDate}
                                    badge={stageIndex + 1}
                                    onClick={openStage}
                                    onCommit={(patch) =>
                                      boardActions.updateStage(
                                        project.id,
                                        stage.id,
                                        patch,
                                      )
                                    }
                                    title={`${stage.name} — 클릭하면 단계 상세, 양 끝을 끌면 기간 조절, 가운데를 끌면 이동`}
                                    label={(start, end) =>
                                      end
                                        ? `${stagePercent}% · ${formatShort(start)}~${formatShort(end)}`
                                        : `${stagePercent}% · ${formatShort(start)}~`
                                    }
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
