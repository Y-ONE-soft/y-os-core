"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { hexToRgba } from "@/components/features/projects/roadmap-utils";
import {
  getTaskDragData,
  isTaskDrag,
  setTaskDragData,
} from "@/components/features/projects/task-drag";

// 일 뷰 = 하루짜리 시간대 그리드. 주·월 뷰(칸 그리드, my-work-calendar)와 달리
// 세로축이 0~23시다. 예정 시각이 있는 할일은 그 시각 행에, 없는 할일("시각 미정")은
// 맨 위 밴드에 놓는다. 여러 날에 걸친 단계 막대는 여기서 그리지 않는다 — 오늘 예정된
// 할일만 보여주는 것이 이 뷰의 목적이다.

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const ROW_PX = 44;

export type DayHourTask = {
  id: string;
  name: string;
  color: string;
  done?: boolean;
  late?: boolean;
  projectId: string | null;
  stageId: string | null;
  /** HH:mm — 없으면 "시각 미정"(하루 종일) */
  scheduledTime?: string;
};

function hourOf(time?: string) {
  if (!time) return null;
  const h = Number(time.slice(0, 2));
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null;
}

function TaskChip({
  task,
  onOpenTask,
  onToggleTask,
}: {
  task: DayHourTask;
  onOpenTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(event) => setTaskDragData(event, task.id)}
      className={cn(
        "group flex h-7 shrink-0 cursor-grab items-center gap-1.5 rounded-[6px] px-1.5 active:cursor-grabbing",
        task.done && "opacity-60",
      )}
      style={{
        backgroundColor: hexToRgba(task.color, task.done ? 0.1 : 0.18),
        // 마감 지난(이월된) 미완료 할일은 붉은 링으로 구분 — 캘린더 칩과 같은 규칙
        boxShadow: task.late ? "0 0 0 1.5px rgb(239 68 68 / 0.8)" : undefined,
      }}
    >
      <span
        onClick={(event) => event.stopPropagation()}
        className="flex shrink-0 items-center"
      >
        <Checkbox
          aria-label={`${task.name} 완료`}
          checked={task.done}
          onCheckedChange={() => onToggleTask(task.id)}
          className="size-3.5 rounded-[4px] border-primary bg-background"
        />
      </span>
      <button
        type="button"
        onClick={() => onOpenTask(task.id)}
        className={cn(
          "min-w-0 flex-1 truncate text-left text-[12px] font-medium leading-[18px]",
          task.done && "text-muted-foreground line-through",
        )}
      >
        {task.name}
      </button>
    </div>
  );
}

export function MyWorkDayHours({
  dayISO,
  isToday,
  tasks,
  onOpenTask,
  onToggleTask,
  onSetTime,
}: {
  dayISO: string;
  isToday: boolean;
  tasks: DayHourTask[];
  onOpenTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  /** time=HH:mm으로 시각 지정, time=null이면 시각 해제("시각 미정"으로) */
  onSetTime: (taskId: string, time: string | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // 드롭 하이라이트 대상 시각(-1 = 시각 미정 밴드)
  const [dropHour, setDropHour] = useState<number | null>(null);
  // 현재 시각 줄 — 마운트 이후에만(서버/클라 불일치 방지). 분 단위 위치.
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);

  useEffect(() => {
    // 첫 setState는 효과 본문이 아니라 다음 프레임에서 — 렌더 중 동기 setState 금지 규칙.
    if (!isToday) {
      const raf = requestAnimationFrame(() => setNowMinutes(null));
      return () => cancelAnimationFrame(raf);
    }
    const tick = () => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    };
    const raf = requestAnimationFrame(tick);
    const id = setInterval(tick, 60_000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, [isToday, dayISO]);

  // 마운트·날짜 변경 시 오전 8시(또는 오늘이면 현재 시각) 부근으로 스크롤을 맞춘다.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const focusHour = isToday ? new Date().getHours() : 8;
    el.scrollTop = Math.max(0, (focusHour - 1) * ROW_PX);
  }, [dayISO, isToday]);

  const allDay = tasks.filter((task) => hourOf(task.scheduledTime) === null);
  const byHour = new Map<number, DayHourTask[]>();
  for (const task of tasks) {
    const h = hourOf(task.scheduledTime);
    if (h === null) continue;
    (byHour.get(h) ?? byHour.set(h, []).get(h)!).push(task);
  }

  function handleDrop(event: React.DragEvent, time: string | null) {
    if (!isTaskDrag(event)) return;
    event.preventDefault();
    setDropHour(null);
    const taskId = getTaskDragData(event);
    if (taskId) onSetTime(taskId, time);
  }

  function allowDrop(event: React.DragEvent, hour: number) {
    if (!isTaskDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropHour(hour);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[8px] border bg-background">
      {/* 시각 미정(하루 종일) 밴드 — 항상 위에 고정. 여기로 끌면 시각을 해제한다. */}
      <div
        onDragOver={(event) => allowDrop(event, -1)}
        onDragLeave={() => setDropHour((prev) => (prev === -1 ? null : prev))}
        onDrop={(event) => handleDrop(event, null)}
        className={cn(
          "flex shrink-0 items-start gap-2 border-b px-2 py-1.5 transition-colors",
          dropHour === -1 && "bg-accent/60",
        )}
      >
        <span className="w-[52px] shrink-0 pt-1 text-[11px] font-medium text-muted-foreground">
          시각 미정
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {allDay.length === 0 ? (
            <span className="py-1 text-[11px] text-muted-foreground/70">
              끌어 놓으면 시각을 비운다
            </span>
          ) : (
            allDay.map((task) => (
              <div key={task.id} className="max-w-[160px]">
                <TaskChip
                  task={task}
                  onOpenTask={onOpenTask}
                  onToggleTask={onToggleTask}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* 시간대 격자 */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        {HOURS.map((hour) => {
          const items = byHour.get(hour) ?? [];
          return (
            <div
              key={hour}
              onDragOver={(event) => allowDrop(event, hour)}
              onDragLeave={() =>
                setDropHour((prev) => (prev === hour ? null : prev))
              }
              onDrop={(event) =>
                handleDrop(event, `${String(hour).padStart(2, "0")}:00`)
              }
              className={cn(
                "flex items-stretch gap-2 border-b px-2 transition-colors",
                dropHour === hour && "bg-accent/60",
              )}
              style={{ minHeight: ROW_PX }}
            >
              <span className="w-[52px] shrink-0 pt-1.5 text-[11px] tabular-nums text-muted-foreground">
                {String(hour).padStart(2, "0")}:00
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1 py-1.5">
                {items.map((task) => (
                  <TaskChip
                    key={task.id}
                    task={task}
                    onOpenTask={onOpenTask}
                    onToggleTask={onToggleTask}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* 현재 시각 줄 (오늘만) */}
        {nowMinutes !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
            style={{ top: (nowMinutes / 60) * ROW_PX }}
          >
            <span className="ml-[52px] size-1.5 shrink-0 rounded-full bg-red-500" />
            <span className="h-px flex-1 bg-red-500/70" />
          </div>
        )}
      </div>
    </div>
  );
}
