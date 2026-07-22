"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Project } from "@/types/workspace";
import { useBoardState } from "@/components/features/projects/board-store";
import {
  addDays,
  fromISO,
  toISO,
} from "@/components/features/projects/roadmap-utils";
import {
  DAYS_PER_WEEK,
  buildMonthGrid,
} from "@/components/features/my-work/my-work-month";

// Figma: Task Status Layout — Master · Calendar (210:969)
// 로드맵이 기간을 가로 막대로 본다면, 이 뷰는 **날짜에 걸린 일정**을 월 달력으로 본다.
// 단계의 시작일과 종료일을 각각 칸에 얹는다 (종료일은 "… 마감").
// 보이는 범위는 호출부가 정한다 — 마스터는 전체, 스탭은 자기 프로젝트.

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

type CalendarEvent = {
  key: string;
  projectId: string;
  stageId: string;
  label: string;
  color: string;
};

export function TaskStatusCalendar({
  projects,
  onOpenStage,
}: {
  projects: Project[];
  onOpenStage?: (projectId: string, stageId: string) => void;
}) {
  const boards = useBoardState();
  // 세션 로딩 이후 클라이언트에서만 첫 렌더되므로 지연 초기화가 안전하다
  const [today] = useState(() => new Date());
  const [monthOffset, setMonthOffset] = useState(0);

  const grid = useMemo(() => {
    const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    return buildMonthGrid(base, today);
  }, [today, monthOffset]);

  /** 날짜(YYYY-MM-DD) → 그 날의 일정 */
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const push = (date: string, event: CalendarEvent) => {
      const list = map.get(date);
      if (list) list.push(event);
      else map.set(date, [event]);
    };
    for (const project of projects) {
      for (const stage of boards[project.id]?.stages ?? []) {
        if (stage.startDate) {
          push(stage.startDate, {
            key: `${stage.id}:start`,
            projectId: project.id,
            stageId: stage.id,
            label: stage.name,
            color: stage.color,
          });
        }
        if (stage.endDate) {
          push(stage.endDate, {
            key: `${stage.id}:end`,
            projectId: project.id,
            stageId: stage.id,
            label: `${stage.name} 마감`,
            color: stage.color,
          });
        }
      }
    }
    return map;
  }, [projects, boards]);

  const gridStartDate = fromISO(grid.gridStart);

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-[8px] border bg-background shadow-[0px_1px_3px_0px_rgba(0,0,0,0.05)]">
      <header className="flex shrink-0 items-center justify-between gap-2 py-2.5 pl-4 pr-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="shrink-0 text-[13.5px] font-semibold">캘린더</h2>
          <p className="truncate text-[11.5px] text-muted-foreground">
            마감일 기준으로 작업을 봅니다
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setMonthOffset(0)}
            className="rounded-[6px] border px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            오늘
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="이전 달"
              onClick={() => setMonthOffset((prev) => prev - 1)}
              className="rounded-[6px] p-1 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="min-w-[74px] text-center text-[12.5px] font-medium">
              {grid.title}
            </span>
            <button
              type="button"
              aria-label="다음 달"
              onClick={() => setMonthOffset((prev) => prev + 1)}
              className="rounded-[6px] p-1 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </header>
      <div className="grid shrink-0 grid-cols-7 border-t text-[11px] font-medium text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day} className="border-r px-2.5 py-[7px] last:border-r-0">
            {day}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr">
        {grid.weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-t">
            {week.map((date, dayIndex) => {
              // 이월 칸(null)도 실제 날짜를 보여준다 — 디자인이 앞뒤 달 날짜를 노출한다
              const iso = toISO(
                addDays(gridStartDate, weekIndex * DAYS_PER_WEEK + dayIndex),
              );
              const dayNumber = date ?? fromISO(iso).getDate();
              const isToday = date !== null && date === grid.todayDate;
              const events = eventsByDate.get(iso) ?? [];
              return (
                <div
                  key={dayIndex}
                  className="flex min-w-0 flex-col gap-[3px] overflow-hidden border-r p-1.5 last:border-r-0"
                >
                  {isToday ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
                      {dayNumber}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "px-1 text-[11px] leading-5",
                        date === null
                          ? "text-muted-foreground/50"
                          : "text-muted-foreground",
                      )}
                    >
                      {dayNumber}
                    </span>
                  )}
                  {events.map((event) => (
                    <button
                      key={event.key}
                      type="button"
                      title={event.label}
                      onClick={() => onOpenStage?.(event.projectId, event.stageId)}
                      className="flex w-full shrink-0 items-center gap-[5px] overflow-hidden rounded-[4px] bg-muted px-1.5 py-[3px] text-left transition-colors hover:bg-accent"
                    >
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: event.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[10.5px] font-medium">
                        {event.label}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
