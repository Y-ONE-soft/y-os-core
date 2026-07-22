"use client";

import { cn } from "@/lib/utils";
import { ROADMAP } from "@/components/features/projects/project-detail-data";
import { useProjectBoard } from "@/components/features/projects/board-store";

const RANGE_OPTIONS = ["오늘", "일", "주", "개월", "분기"] as const;
const ACTIVE_RANGE = "주";

const DAY_MS = 86_400_000;

function dayOffset(date: string) {
  return Math.round(
    (new Date(date).getTime() - new Date(ROADMAP.start).getTime()) / DAY_MS,
  );
}

function formatShort(date: string) {
  return date.slice(5).replace("-", "/");
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function ProjectRoadmap({
  projectId,
  onAddStage,
}: {
  projectId: string;
  onAddStage: () => void;
}) {
  const { stages } = useProjectBoard(projectId);

  return (
    <section className="w-full shrink-0 rounded-[12px] border bg-background shadow-[0px_1px_3px_0px_rgba(0,0,0,0.05)]">
      <header className="flex items-center justify-between py-2.5 pl-4 pr-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[13.5px] font-semibold">단계 로드맵</h2>
          <p className="text-[11.5px] text-muted-foreground">
            막대 드래그로 이동·기간 조절
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddStage}
            className="rounded-full border px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            ＋ 단계
          </button>
          <div className="flex items-center gap-0.5 rounded-full bg-muted p-[3px]">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={option === ACTIVE_RANGE}
                className={cn(
                  "rounded-full px-[9px] py-[3px] text-[11px] font-medium transition-colors",
                  option === ACTIVE_RANGE
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-[180px] right-0"
        >
          <div className="grid h-full grid-cols-4">
            {ROADMAP.ticks.map((tick) => (
              <div key={tick} className="border-l border-border" />
            ))}
          </div>
          <div
            className="absolute inset-y-0 w-[2px] bg-primary"
            style={{ left: `${(ROADMAP.todayDay / ROADMAP.days) * 100}%` }}
          />
        </div>
        <div className="flex h-6 items-center border-t text-[10.5px] font-medium text-muted-foreground">
          <div className="w-[180px] shrink-0 pl-4">단계</div>
          <div className="grid min-w-0 flex-1 grid-cols-4">
            {ROADMAP.ticks.map((tick) => (
              <div key={tick} className="pl-1.5">
                {tick}
              </div>
            ))}
          </div>
        </div>
        {stages.map((stage) => {
          const done = stage.tasks.filter((task) => task.done).length;
          const total = stage.tasks.length;
          const percent = total === 0 ? 0 : Math.round((done / total) * 100);
          const hasBar = Boolean(
            stage.showDeadline && stage.startDate && stage.endDate,
          );
          const startDay = hasBar ? Math.max(0, dayOffset(stage.startDate!)) : 0;
          const barDays = hasBar
            ? Math.min(
                ROADMAP.days - startDay,
                dayOffset(stage.endDate!) - dayOffset(stage.startDate!) + 1,
              )
            : 0;
          return (
            <div
              key={stage.id}
              className="flex h-[30px] items-stretch border-t"
            >
              <div className="flex w-[180px] shrink-0 items-center gap-1.5 pl-4 pr-2.5">
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {stage.name}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {done}/{total}
                </span>
              </div>
              <div className="relative min-w-0 flex-1">
                {hasBar && barDays > 0 && (
                  <div
                    className="absolute top-1.5 flex h-[18px] items-center overflow-hidden rounded-[6px] border pl-2"
                    style={{
                      left: `${(startDay / ROADMAP.days) * 100}%`,
                      width: `${(barDays / ROADMAP.days) * 100}%`,
                      backgroundColor: hexToRgba(stage.color, 0.12),
                      borderColor: hexToRgba(stage.color, 0.8),
                    }}
                  >
                    <span
                      className="whitespace-nowrap text-[10.5px] font-medium"
                      style={{ color: stage.color }}
                    >
                      {percent}% · {formatShort(stage.startDate!)}~
                      {formatShort(stage.endDate!)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div className="flex h-7 items-center border-t">
          <button
            type="button"
            onClick={onAddStage}
            className="flex h-full w-[180px] shrink-0 items-center pl-4 pr-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            ＋ 단계 추가
          </button>
        </div>
      </div>
    </section>
  );
}
