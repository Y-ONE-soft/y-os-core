"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  hexToRgba,
  shiftISO,
  type DragMode,
} from "@/components/features/projects/roadmap-utils";
import type { MonthGrid } from "@/components/features/my-work/my-work-month";
import {
  getTaskDragData,
  isTaskDrag,
} from "@/components/features/projects/task-drag";
import type { CalendarProject } from "@/components/features/my-work/my-work-calendar-source";
import {
  type PlacedOverlay,
  type ProjectBox,
  type WeekLayout,
} from "@/components/features/my-work/my-work-calendar-layout";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const DATE_ROW_PX = 24; // 날짜 숫자 영역
const LANE_PX = 26; // 스팬 레인 1단 높이
const STAGE_PX = 22; // 단계 막대 높이 — 겹쳐도 집어낼 수 있게 두껍게
const TASK_PX = 20; // 할일 칩 높이

/** 클릭과 드래그를 가르는 이동량(px) — 로드맵 막대와 같은 기준 */
const DRAG_THRESHOLD = 3;
/** 막대 양 끝 리사이즈 손잡이 폭(px) */
const HANDLE_PX = 8;

export type StageDragPhase = "move" | "commit" | "cancel";

/** 드래그 대상 — 단계는 이동·양끝 조절, 할일은 날짜 이동만 */
export type DragTarget =
  | { kind: "stage"; stageId: string; mode: DragMode }
  | { kind: "task"; taskId: string };

function laneTop(lane: number) {
  return DATE_ROW_PX + lane * LANE_PX;
}

function colLeft(col: number) {
  return `${(col / 7) * 100}%`;
}

function colWidth(span: number) {
  return `${(span / 7) * 100}%`;
}

/** 막대 위 글자용 — 배경 틴트가 옅어 원색 그대로는 대비가 모자란다. */
function shade(hex: string, factor: number) {
  const channel = (start: number) =>
    Math.round(parseInt(hex.slice(start, start + 2), 16) * factor);
  const hex2 = (value: number) => value.toString(16).padStart(2, "0");
  return `#${hex2(channel(1))}${hex2(channel(3))}${hex2(channel(5))}`;
}

/** 프로젝트 박스 — 그 프로젝트의 단계 줄과 할일 줄을 함께 감싼다. */
function ProjectBoxItem({
  box,
  project,
}: {
  box: ProjectBox;
  project: CalendarProject | undefined;
}) {
  const color = project?.color ?? "#71717a";

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute border",
        // 주 경계에서 잘린 면은 열어 둬야 다음 주로 이어진 한 범위로 읽힌다
        box.continuesLeft ? "border-l-0" : "rounded-l-[2px]",
        box.continuesRight ? "border-r-0" : "rounded-r-[2px]",
      )}
      style={{
        left: colLeft(box.col),
        width: colWidth(box.span),
        top: laneTop(box.lane) - 3,
        height: box.lanes * LANE_PX + 4,
        backgroundColor: hexToRgba(color, 0.07),
        borderColor: hexToRgba(color, 0.3),
      }}
    >
      {/* 프로젝트 이름은 범위가 시작하는 주에만 — 주마다 반복하지 않는다 */}
      {!box.continuesLeft && project && (
        <span
          className="absolute right-1 top-0.5 max-w-full truncate text-[9px] font-medium"
          style={{ color: hexToRgba(color, 0.75) }}
        >
          {project.name}
        </span>
      )}
      {/* 할일이 늘어도 박스는 한 덩어리로 둔다 — 줄 구분선을 그으면 프로젝트가
          여러 개로 쪼개진 것처럼 읽힌다 */}
    </div>
  );
}

function OverlayItem({
  overlay,
  hoveredStageId,
  onHoverStage,
  onOpenStage,
  onOpenTask,
  onToggleTask,
  onDragStart,
}: {
  overlay: PlacedOverlay;
  /** 주 경계로 잘린 조각들을 한 단계로 묶어 강조하기 위한 공유 호버 상태 */
  hoveredStageId?: string | null;
  onHoverStage?: (stageId: string | null) => void;
  onOpenStage?: (projectId: string, stageId: string) => void;
  onOpenTask?: (taskId: string) => void;
  /** 칩의 체크박스 — 상세를 열지 않고 완료를 토글한다 */
  onToggleTask?: (taskId: string) => void;
  onDragStart?: (event: React.PointerEvent, target: DragTarget) => void;
}) {
  const color = overlay.color;
  const text = shade(color, 0.6);
  const left = colLeft(overlay.col);
  const width = colWidth(overlay.span);

  if (overlay.kind === "stage") {
    const draggable = Boolean(onDragStart);
    // CSS :hover는 커서가 놓인 조각만 잡는다 — 같은 단계의 다른 주 조각까지
    // 함께 강조하려면 상태로 묶어야 한다
    const active = hoveredStageId === overlay.stageId;
    return (
      <div
        className="absolute"
        style={{
          left: `calc(${left} + 4px)`,
          width: `calc(${width} - 8px)`,
          top: laneTop(overlay.lane),
          height: STAGE_PX,
        }}
      >
        <button
          type="button"
          onPointerDown={(event) =>
            onDragStart?.(event, {
              kind: "stage",
              stageId: overlay.stageId,
              mode: "move",
            })
          }
          onClick={() => onOpenStage?.(overlay.project, overlay.stageId)}
          onPointerEnter={() => onHoverStage?.(overlay.stageId)}
          onPointerLeave={() => onHoverStage?.(null)}
          onFocus={() => onHoverStage?.(overlay.stageId)}
          onBlur={() => onHoverStage?.(null)}
          title={overlay.label}
          className={cn(
            "flex size-full items-center gap-1 overflow-hidden rounded-[4px] px-1 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2",
            active && "ring-1",
            draggable && "cursor-grab active:cursor-grabbing",
          )}
          style={{
            // 강조 시 배경도 함께 진해져 여러 주에 걸친 한 단계가 통으로 보인다
            backgroundColor: hexToRgba(color, active ? 0.3 : 0.18),
            // ring 색을 단계 색에 맞춘다 (임의 색 클래스 대신 CSS 변수)
            ["--tw-ring-color" as string]: hexToRgba(color, 0.8),
          }}
        >
          {/* 이름·개수는 단계가 시작하는 주에만 — 주마다 반복하면 같은 단계가
              여러 개인 것처럼 읽힌다 (프로젝트 이름과 같은 규칙) */}
          {overlay.startsHere && (
            <>
              <span
                aria-hidden
                className="flex size-[11px] shrink-0 items-center justify-center rounded-full text-[7.5px] font-medium text-white"
                style={{ backgroundColor: color }}
              >
                {overlay.count}
              </span>
              <span
                className="truncate text-[10px] font-medium"
                style={{ color: text }}
              >
                {overlay.label}
              </span>
            </>
          )}
          {overlay.deadline && (
            <span
              className="ml-auto shrink-0 rounded-[3px] px-1.5 py-px text-[9px] font-medium text-white"
              style={{ backgroundColor: text }}
            >
              마감
            </span>
          )}
        </button>
        {/* 기간 조절 손잡이 — 실제 시작·종료가 든 조각에만 단다 */}
        {draggable && overlay.startsHere && (
          <div
            role="presentation"
            aria-label={`${overlay.label} 시작일 조절`}
            onPointerDown={(event) =>
              onDragStart?.(event, {
                kind: "stage",
                stageId: overlay.stageId,
                mode: "start",
              })
            }
            className="absolute inset-y-0 left-0 cursor-ew-resize rounded-l-[4px]"
            style={{ width: HANDLE_PX }}
          />
        )}
        {draggable && overlay.endsHere && (
          <div
            role="presentation"
            aria-label={`${overlay.label} 종료일 조절`}
            onPointerDown={(event) =>
              onDragStart?.(event, {
                kind: "stage",
                stageId: overlay.stageId,
                mode: "end",
              })
            }
            className="absolute inset-y-0 right-0 cursor-ew-resize rounded-r-[4px]"
            style={{ width: HANDLE_PX }}
          />
        )}
      </div>
    );
  }

  // 체크박스는 그 자리에서 완료를 토글하고, 나머지 영역은 상세를 연다.
  // 버튼 중첩은 불가능하므로 컨테이너를 두고 둘을 나란히 놓는다.
  // 드래그와 클릭의 구분은 캘린더 루트의 moved 플래그가 처리한다.
  return (
    <div
      className={cn(
        "absolute flex items-center gap-1 overflow-hidden rounded-[4px] px-1",
        onDragStart && "cursor-grab active:cursor-grabbing",
      )}
      style={{
        left: `calc(${left} + 4px)`,
        width: `calc(${width} - 8px)`,
        top: laneTop(overlay.lane),
        height: TASK_PX,
        backgroundColor: overlay.done ? hexToRgba(text, 0.1) : undefined,
      }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={Boolean(overlay.done)}
        aria-label={`${overlay.label} 완료`}
        // 체크박스에서 시작한 포인터는 드래그로 넘기지 않는다 — 칩을 옮기려다
        // 완료가 눌리거나, 체크하려다 일정이 움직이는 일을 막는다
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onToggleTask?.(overlay.taskId);
        }}
        className={cn(
          "flex size-[11px] shrink-0 items-center justify-center rounded-[2px] text-[7px] text-white transition-shadow focus-visible:outline-none focus-visible:ring-2",
          !overlay.done && "border-[1.2px]",
        )}
        style={{
          ...(overlay.done
            ? { backgroundColor: text }
            : { borderColor: text }),
          ["--tw-ring-color" as string]: hexToRgba(color, 0.8),
        }}
      >
        {overlay.done ? "✓" : ""}
      </button>
      <button
        type="button"
        title={overlay.label}
        onPointerDown={(event) =>
          onDragStart?.(event, { kind: "task", taskId: overlay.taskId })
        }
        onClick={() => onOpenTask?.(overlay.taskId)}
        className="min-w-0 flex-1 truncate text-left transition-shadow hover:ring-1 focus-visible:outline-none focus-visible:ring-2"
        style={{ ["--tw-ring-color" as string]: hexToRgba(color, 0.8) }}
      >
        <span
          className={cn(
            "truncate text-[10px] font-medium",
            overlay.done && "line-through",
          )}
          style={{ color: overlay.done ? hexToRgba(text, 0.7) : text }}
        >
          {overlay.label}
        </span>
      </button>
    </div>
  );
}

export function MyWorkCalendar({
  grid,
  layouts,
  projects,
  onOpenStage,
  onOpenTask,
  onToggleTask,
  onDrag,
  onDropTask,
}: {
  grid: MonthGrid;
  layouts: WeekLayout[];
  projects: Record<string, CalendarProject>;
  onOpenStage?: (projectId: string, stageId: string) => void;
  onOpenTask?: (taskId: string) => void;
  /** 캘린더 칩 체크박스로 완료 토글 */
  onToggleTask?: (taskId: string) => void;
  /** 드래그 중(move)에는 미리보기, 손을 뗄 때(commit) 저장한다 */
  onDrag?: (
    target: DragTarget,
    deltaDays: number,
    phase: StageDragPhase,
  ) => void;
  /** 백로그에서 끌어온 할일을 날짜 칸에 떨어뜨렸을 때 (HTML5 DnD) */
  onDropTask?: (taskId: string, date: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // 백로그에서 끌어온 할일이 놓일 날짜 칸 — 어디에 떨어지는지 보이게 한다
  const [dropDate, setDropDate] = useState<string | null>(null);
  const weekRefs = useRef<(HTMLDivElement | null)[]>([]);
  // 주 경계로 잘린 단계 조각을 하나로 묶어 강조한다 (CSS :hover는 조각 단위)
  const [hoveredStageId, setHoveredStageId] = useState<string | null>(null);
  const dragRef = useRef<{
    target: DragTarget;
    pointerId: number;
    startDay: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  /** 포인터가 놓인 칸의 그리드 일자(주 × 7 + 열). 주 행 높이가 제각각이라 행 사각형으로 찾는다. */
  function dayFromPointer(clientX: number, clientY: number) {
    const rows = weekRefs.current;
    let weekIndex = 0;
    for (let index = 0; index < rows.length; index += 1) {
      const rect = rows[index]?.getBoundingClientRect();
      if (!rect) continue;
      if (clientY < rect.bottom) {
        weekIndex = index;
        break;
      }
      weekIndex = index; // 마지막 주 아래로 벗어나면 그 주로 본다
    }
    const rect = rows[weekIndex]?.getBoundingClientRect();
    if (!rect) return 0;
    // 열은 자르지 않는다 — 행 좌우로 끌면 앞뒤 주로 자연스럽게 넘어가야 한다
    const col = Math.floor(((clientX - rect.left) / rect.width) * 7);
    const lastDay = rows.length * 7 - 1;
    return Math.min(lastDay, Math.max(0, weekIndex * 7 + col));
  }

  function handleDragStart(event: React.PointerEvent, target: DragTarget) {
    if (!onDrag || event.button !== 0) return;
    event.stopPropagation();
    // 캡처는 임계값을 넘어 '드래그'로 확정될 때 건다. 여기서 바로 잡으면
    // click 이벤트가 캡처 대상(루트)으로 가버려 막대 클릭이 먹지 않는다.
    dragRef.current = {
      target,
      pointerId: event.pointerId,
      startDay: dayFromPointer(event.clientX, event.clientY),
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
    };
  }

  function handlePointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || !onDrag) return;
    const far =
      Math.abs(event.clientX - drag.originX) > DRAG_THRESHOLD ||
      Math.abs(event.clientY - drag.originY) > DRAG_THRESHOLD;
    if (!far && !drag.moved) return;
    if (!drag.moved) {
      // 막대·칩은 드래그 중 주 경계를 넘거나 사라질 수 있다. 그 순간 언마운트되면
      // 거기 건 캡처는 끊기므로, 안정적인 캘린더 루트로 캡처를 잡는다.
      rootRef.current?.setPointerCapture(drag.pointerId);
    }
    drag.moved = true;
    const delta = dayFromPointer(event.clientX, event.clientY) - drag.startDay;
    onDrag(drag.target, delta, "move");
  }

  function handlePointerUp(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || !onDrag) return;
    dragRef.current = null;
    if (!drag.moved) {
      // 움직이지 않았으면 클릭 — 미리보기를 되돌리고 버튼 onClick에 맡긴다
      onDrag(drag.target, 0, "cancel");
      return;
    }
    const delta = dayFromPointer(event.clientX, event.clientY) - drag.startDay;
    onDrag(drag.target, delta, "commit");
  }

  return (
    <div
      ref={rootRef}
      className="flex min-h-0 w-full flex-1 flex-col overflow-clip rounded-[10px] border bg-card"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="flex w-full">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className={cn(
              "flex flex-1 justify-center border-b py-1.5 text-[11px] font-medium",
              day === "일"
                ? "text-[rgba(219,38,38,0.75)]"
                : day === "토"
                  ? "text-[rgba(38,99,235,0.75)]"
                  : "text-muted-foreground",
            )}
          >
            {day}
          </div>
        ))}
      </div>
      {grid.weeks.map((week, weekIndex) => {
        const { boxes, overlays, laneCount } = layouts[weekIndex];
        const minHeight = laneCount > 0 ? DATE_ROW_PX + laneCount * LANE_PX + 8 : undefined;
        return (
          <div
            key={weekIndex}
            ref={(node) => {
              weekRefs.current[weekIndex] = node;
            }}
            className="relative flex w-full flex-1"
            style={{ minHeight }}
          >
            {week.map((date, dayIndex) => {
              const cellDate = shiftISO(
                grid.gridStart,
                weekIndex * 7 + dayIndex,
              );
              return (
              <div
                key={dayIndex}
                onDragOver={(event) => {
                  if (!onDropTask || !isTaskDrag(event)) return;
                  event.preventDefault(); // 기본값은 '드롭 금지'
                  event.dataTransfer.dropEffect = "move";
                  setDropDate(cellDate);
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget as Node)) {
                    return;
                  }
                  setDropDate((prev) => (prev === cellDate ? null : prev));
                }}
                onDrop={(event) => {
                  const taskId = getTaskDragData(event);
                  setDropDate(null);
                  if (!onDropTask || !taskId) return;
                  event.preventDefault();
                  onDropTask(taskId, cellDate);
                }}
                className={cn(
                  "flex-1 border-b px-2 pb-1 pt-1.5",
                  dayIndex < 6 && "border-r",
                  date === null && "bg-muted",
                  date !== null && date === grid.todayDate && "bg-accent",
                  dropDate === cellDate && "bg-primary/10 ring-1 ring-inset ring-primary",
                )}
              >
                {date !== null && (
                  <span
                    className={cn(
                      "text-[11px] text-muted-foreground",
                      date === grid.todayDate && "font-medium text-foreground",
                    )}
                  >
                    {date}
                  </span>
                )}
              </div>
              );
            })}
            {boxes.map((box) => (
              <ProjectBoxItem
                key={box.project}
                box={box}
                project={projects[box.project]}
              />
            ))}
            {overlays.map((overlay) => (
              <OverlayItem
                // 조각 단위로 안정된 키 — 인덱스 키는 드래그 중 재배치에서 엉킨다
                key={`${overlay.kind === "stage" ? overlay.stageId : overlay.taskId}:${overlay.col}`}
                overlay={overlay}
                hoveredStageId={hoveredStageId}
                onHoverStage={setHoveredStageId}
                onOpenStage={onOpenStage}
                onOpenTask={onOpenTask}
                onToggleTask={onToggleTask}
                onDragStart={onDrag ? handleDragStart : undefined}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
