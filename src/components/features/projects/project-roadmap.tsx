"use client";

import { useCallback, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  boardActions,
  useProjectBoard,
} from "@/components/features/projects/board-store";
import { formatShort } from "@/components/features/projects/roadmap-utils";
import { RoadmapBar } from "@/components/features/projects/roadmap-bar";
import {
  getStageDragData,
  isStageDrag,
  setStageDragData,
} from "@/components/features/projects/stage-drag";
import {
  RANGE_OPTIONS,
  boundsOfStages,
  buildTimeline,
  formatPeriod,
  todayISO,
  type RoadmapRange,
} from "@/components/features/projects/roadmap-window";

const LABEL_WIDTH = 180;
/** 맨 뒤로 보내는 드롭 자리 — 단계 id와 겹치지 않는 표식 */
const END_SLOT = "__end__";
/** 스크롤 위치를 잡을 때 오늘을 왼쪽에서 이만큼 떨어뜨린다 */
const TODAY_LEFT_INSET = 120;

export function ProjectRoadmap({
  projectId,
  onAddStage,
  onSavePreset,
  onOpenStage,
}: {
  projectId: string;
  onAddStage: () => void;
  onSavePreset: () => void;
  onOpenStage: (stageId: string) => void;
}) {
  const { stages } = useProjectBoard(projectId);
  const [range, setRange] = useState<RoadmapRange>("주");
  // 세션 로딩 이후 클라이언트에서만 첫 렌더되므로 지연 초기화가 안전하다
  const [today] = useState(todayISO);
  // 단계 순서 변경 드래그 — 끌고 있는 행과 끼워 넣을 자리
  const [draggingStageId, setDraggingStageId] = useState<string | null>(null);
  const [orderTargetId, setOrderTargetId] = useState<string | null>(null);

  const endStageDrag = () => {
    setDraggingStageId(null);
    setOrderTargetId(null);
  };

  // 단계 기간이 기본 범위(앞뒤 2년) 밖이면 그 막대까지 스크롤해 갈 수 있어야 한다
  const timeline = buildTimeline(range, today, boundsOfStages(stages));
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

  return (
    <section className="w-full shrink-0 overflow-hidden rounded-[8px] border bg-background shadow-[0px_1px_3px_0px_rgba(0,0,0,0.05)]">
      <header className="flex items-center justify-between gap-3 py-2.5 pl-4 pr-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="shrink-0 text-[13.5px] font-semibold">단계 로드맵</h2>
          <p className="truncate text-[11.5px] text-muted-foreground">
            {formatPeriod(timeline)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* 저장 대상이 이 카드의 단계 구성이므로 ＋단계·레인지 스위처와 같은 자리에 둔다.
              아이콘은 사이드바 워크스페이스의 '프리셋' 메뉴와 같은 것. */}
          <button
            type="button"
            onClick={onSavePreset}
            className="flex items-center gap-1 rounded-[6px] border px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <SlidersHorizontal className="size-3.5" />
            프리셋 저장
          </button>
          <button
            type="button"
            onClick={onAddStage}
            className="rounded-[6px] border px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            ＋ 단계
          </button>
          <div className="flex items-center gap-0.5 rounded-[8px] bg-muted p-[3px]">
            <button
              type="button"
              onClick={() => scrollToToday()}
              className="rounded-[6px] px-[9px] py-[3px] text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
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
          <div className="sticky top-0 z-30 flex h-6 items-stretch bg-background text-[10.5px] font-medium text-muted-foreground">
            <div
              className="sticky left-0 z-10 flex shrink-0 items-center border-r bg-background pl-4"
              style={{ width: LABEL_WIDTH }}
            >
              단계
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
          {stages.map((stage, index) => {
            const done = stage.tasks.filter((task) => task.done).length;
            const total = stage.tasks.length;
            const percent = total === 0 ? 0 : Math.round((done / total) * 100);
            // 기간이 있으면 항상 막대를 그린다 — 데드라인 표시는 캘린더 마감
            // 라벨 전용 설정이라 로드맵과 무관하다
            const showBar = Boolean(stage.startDate);
            return (
              <div
                key={stage.id}
                onDragOver={(event) => {
                  if (!isStageDrag(event)) return;
                  event.preventDefault(); // 기본값은 '드롭 금지'라 막아줘야 놓을 수 있다
                  event.dataTransfer.dropEffect = "move";
                  setOrderTargetId(stage.id);
                }}
                onDragLeave={(event) => {
                  // 자식 위로 옮겨갈 때도 leave가 뜨므로 행 밖으로 나갔을 때만 끈다
                  if (event.currentTarget.contains(event.relatedTarget as Node))
                    return;
                  setOrderTargetId((prev) =>
                    prev === stage.id ? null : prev,
                  );
                }}
                onDrop={(event) => {
                  const movedStageId = getStageDragData(event);
                  endStageDrag();
                  if (!movedStageId) return;
                  event.preventDefault();
                  // 끌어온 단계가 이 행 자리를 차지하고, 이 행부터 아래로 밀린다
                  boardActions.moveStage(projectId, movedStageId, stage.id);
                }}
                className={cn(
                  "relative flex h-[30px] items-stretch border-t",
                  draggingStageId === stage.id && "opacity-40",
                )}
              >
                {/* 끼워 넣을 자리 — 이 행 위에 들어간다 */}
                {orderTargetId === stage.id &&
                  draggingStageId !== stage.id && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 -top-px z-40 h-[2px] bg-primary"
                    />
                  )}
                <div
                  draggable
                  onDragStart={(event) => {
                    setStageDragData(event, stage.id);
                    setDraggingStageId(stage.id);
                  }}
                  onDragEnd={endStageDrag}
                  className="sticky left-0 z-20 flex shrink-0 cursor-grab items-center gap-1.5 border-r bg-background pl-4 pr-2.5 active:cursor-grabbing"
                  style={{ width: LABEL_WIDTH }}
                >
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <button
                    type="button"
                    onClick={() => onOpenStage(stage.id)}
                    className="min-w-0 flex-1 truncate text-left text-xs font-medium transition-colors hover:text-primary/80 hover:underline"
                  >
                    {stage.name}
                  </button>
                  <span className="text-[11px] text-muted-foreground">
                    {done}/{total}
                  </span>
                </div>
                <div
                  className="relative shrink-0"
                  style={{ width: timeline.width }}
                >
                  {showBar && (
                    <RoadmapBar
                      timeline={timeline}
                      color={stage.color}
                      startDate={stage.startDate!}
                      endDate={stage.endDate}
                      badge={index + 1}
                      onClick={() => onOpenStage(stage.id)}
                      title={`${stage.name} 단계 상세 열기`}
                      label={(start, end) =>
                        `${percent}% · ${formatShort(start)}~${end ? formatShort(end) : ""}`
                      }
                      onCommit={(patch) =>
                        boardActions.updateStage(projectId, stage.id, patch)
                      }
                    />
                  )}
                </div>
              </div>
            );
          })}
          {/* 단계 추가 진입점 겸 맨 뒤로 보내는 드롭 자리 */}
          <div
            onDragOver={(event) => {
              if (!isStageDrag(event)) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setOrderTargetId(END_SLOT);
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node))
                return;
              setOrderTargetId((prev) => (prev === END_SLOT ? null : prev));
            }}
            onDrop={(event) => {
              const movedStageId = getStageDragData(event);
              endStageDrag();
              if (!movedStageId) return;
              event.preventDefault();
              boardActions.moveStage(projectId, movedStageId, null);
            }}
            className="relative flex h-7 items-stretch border-t"
          >
            {orderTargetId === END_SLOT && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-px z-40 h-[2px] bg-primary"
              />
            )}
            <button
              type="button"
              onClick={onAddStage}
              className="sticky left-0 z-20 flex shrink-0 items-center border-r bg-background pl-4 pr-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              style={{ width: LABEL_WIDTH }}
            >
              ＋ 단계 추가
            </button>
            <div className="shrink-0" style={{ width: timeline.width }} />
          </div>
        </div>
      </div>
    </section>
  );
}
