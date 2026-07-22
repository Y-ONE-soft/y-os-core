"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  barRange,
  dragStageDates,
  type DragMode,
  type StageDates,
} from "@/components/features/projects/roadmap-utils";
import {
  barSurface,
  barTextTone,
} from "@/components/features/projects/project-palette";
import type { RoadmapTimeline } from "@/components/features/projects/roadmap-window";

// 간트 막대 — 작업 현황 로드맵과 프로젝트 상세 단계 로드맵이 공유한다.
// 드래그로 이동(본체)·기간 조절(양 끝 손잡이)을 지원하며, 손을 뗄 때만 저장한다.

/** 클릭과 드래그를 가르는 이동량(px) — 이보다 덜 움직이면 클릭으로 본다 */
const DRAG_THRESHOLD = 3;
/** 막대 양 끝 리사이즈 손잡이 폭(px) */
const HANDLE_WIDTH = 6;

export function RoadmapBar({
  timeline,
  color,
  startDate,
  endDate,
  label,
  badge,
  onClick,
  title,
  onCommit,
  resizable = true,
}: {
  timeline: RoadmapTimeline;
  color: string;
  startDate: string;
  endDate?: string;
  /** 함수를 넘기면 드래그 미리보기 날짜로 라벨을 다시 그린다 */
  label: string | ((start: string, end?: string) => string);
  /** 단계 순번 — 내 할일 캘린더와 같은 원형 배지로 표시 */
  badge?: number;
  onClick?: () => void;
  title?: string;
  /** 드래그로 기간이 바뀌면 호출 — 넘기지 않으면 드래그 비활성 */
  onCommit?: (patch: StageDates) => void;
  /**
   * 양 끝 손잡이로 기간을 조절할 수 있는지. 기본 true.
   * 기간이 파생값인 막대(예: 프로젝트 전체 범위)는 늘렸을 때 무엇이 늘어나야
   * 하는지 정의되지 않으므로 false로 두고 통째 이동만 허용한다.
   */
  resizable?: boolean;
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
    ...barSurface(color),
  };
  const className = cn(
    "absolute top-1 flex h-[18px] items-center overflow-hidden rounded-[6px] border text-left",
    badge === undefined ? "pl-2" : "gap-1 pl-1 pr-1.5",
    // cursor-move: 손 모양(grab)은 "집는다"는 은유라 간트 막대엔 과하다.
    // 이동은 move, 양 끝 리사이즈는 ew-resize로 커서만 보고도 구분되게 한다.
    // touch-none: 터치로 막대를 끌 때 가로 스크롤이 같이 먹지 않게 한다
    draggable && "cursor-move touch-none select-none",
    draft && "z-10 shadow-sm",
  );
  const handles = draggable && resizable && (
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
        style={{ color: barTextTone(color) }}
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
