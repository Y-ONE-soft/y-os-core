"use client";

import { useMemo, useState } from "react";

import type { Project } from "@/types/workspace";
import {
  addDays,
  fromISO,
  toISO,
} from "@/components/features/projects/roadmap-utils";
import { useBoardState } from "@/components/features/projects/board-store";
import {
  buildDayGrid,
  buildMonthGrid,
  buildWeekGrid,
  type CalendarView,
} from "@/components/features/my-work/my-work-month";
import { buildCalendarSource } from "@/components/features/my-work/my-work-calendar-source";
import { buildWeekLayouts } from "@/components/features/my-work/my-work-calendar-layout";
import { MyWorkCalendar } from "@/components/features/my-work/my-work-calendar";
import { MyWorkCalendarToolbar } from "@/components/features/my-work/my-work-calendar-toolbar";

// 작업 현황의 캘린더 뷰 — 내 할일 캘린더와 **같은 화면**을 쓴다.
// 다른 점은 두 가지뿐이다.
//  1. 대상 범위: 내 할일은 "내 프로젝트", 여기는 호출부가 준 범위
//     (마스터 = 전체, 스탭 = 자기 것 — task-status-page가 이미 계산한다)
//  2. 읽기 전용: 드래그 일정 변경·체크박스 완료·백로그 드롭을 주지 않는다.
//     상세 열기(단계·할일)는 조회이므로 그대로 둔다.

export function TaskStatusCalendar({
  projects,
  onOpenStage,
  onOpenTask,
}: {
  projects: Project[];
  onOpenStage?: (projectId: string, stageId: string) => void;
  onOpenTask?: (taskId: string) => void;
}) {
  const boards = useBoardState();
  // 내 할일 캘린더와 같은 보기 전환 — 일·주·월 + 오늘로 돌아가기.
  const [view, setView] = useState<CalendarView>("month");
  const [anchorISO, setAnchorISO] = useState(() => toISO(new Date()));

  const grid = useMemo(() => {
    const anchor = fromISO(anchorISO);
    const today = new Date();
    if (view === "day") return buildDayGrid(anchor, today);
    if (view === "week") return buildWeekGrid(anchor, today);
    return buildMonthGrid(anchor, today);
  }, [view, anchorISO]);
  // 미배정 할일은 넘기지 않는다 — 작업 현황은 프로젝트 범위를 보는 화면이다
  const source = useMemo(
    () => buildCalendarSource(grid, projects, boards),
    [grid, projects, boards],
  );
  const layouts = useMemo(
    () => buildWeekLayouts(source.overlays, grid.rowCount, grid.columns),
    [source.overlays, grid.rowCount, grid.columns],
  );

  // ◀▶ 이동 — 보기 단위만큼 앵커를 옮긴다 (일=1일, 주=7일, 월=한 달). 내 할일 캘린더와 동일.
  function shiftPeriod(direction: -1 | 1) {
    const anchor = fromISO(anchorISO);
    if (view === "day") {
      setAnchorISO(toISO(addDays(anchor, direction)));
    } else if (view === "week") {
      setAnchorISO(toISO(addDays(anchor, direction * 7)));
    } else {
      setAnchorISO(
        toISO(new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1)),
      );
    }
  }

  const periodLabel =
    view === "day" ? "이 날" : view === "week" ? "이 주" : "이 달";

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          aria-label="이전"
          onClick={() => shiftPeriod(-1)}
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ◀
        </button>
        {/* 제목 폭 고정 — 1자리 달에도 폭이 같아야 화살표가 밀리지 않는다 (내 할일 캘린더와 동일) */}
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
          onToday={() => setAnchorISO(toISO(new Date()))}
          className="ml-auto"
        />
      </div>
      {/* onDrag·onDropTask·onToggleTask를 주지 않으면 읽기 전용이 된다 */}
      <MyWorkCalendar
        grid={grid}
        layouts={layouts}
        projects={source.projects}
        onOpenStage={onOpenStage}
        onOpenTask={onOpenTask}
      />
    </section>
  );
}
