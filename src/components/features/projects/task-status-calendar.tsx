"use client";

import { useMemo, useState } from "react";

import type { Project } from "@/types/workspace";
import { useBoardState } from "@/components/features/projects/board-store";
import { buildMonthGrid } from "@/components/features/my-work/my-work-month";
import { buildCalendarSource } from "@/components/features/my-work/my-work-calendar-source";
import { buildWeekLayouts } from "@/components/features/my-work/my-work-calendar-layout";
import { MyWorkCalendar } from "@/components/features/my-work/my-work-calendar";

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
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const grid = useMemo(
    () => buildMonthGrid(monthAnchor, new Date()),
    [monthAnchor],
  );
  // 미배정 할일은 넘기지 않는다 — 작업 현황은 프로젝트 범위를 보는 화면이다
  const source = useMemo(
    () => buildCalendarSource(grid, projects, boards),
    [grid, projects, boards],
  );
  const layouts = useMemo(
    () => buildWeekLayouts(source.overlays, grid.weekCount),
    [source.overlays, grid.weekCount],
  );

  function shiftMonth(amount: number) {
    setMonthAnchor(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + amount, 1),
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => shiftMonth(-1)}
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ◀
        </button>
        {/* 월 숫자 고정폭 — 1자리 달에도 제목 폭이 같아야 화살표가 밀리지 않는다
            (내 할일 캘린더와 동일) */}
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
