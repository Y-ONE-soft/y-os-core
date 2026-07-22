"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { useSession } from "@/components/features/auth/session-context";
import { useProjectStore } from "@/components/features/projects/project-store";
import { useBoardState } from "@/components/features/projects/board-store";
import { StageDetailOverlay } from "@/components/features/projects/stage-detail-overlay";
import { MyWorkCalendar } from "@/components/features/my-work/my-work-calendar";
import { buildMonthGrid } from "@/components/features/my-work/my-work-month";
import { buildCalendarSource } from "@/components/features/my-work/my-work-calendar-source";
import { buildWeekLayouts } from "@/components/features/my-work/my-work-calendar-layout";

const RANGE_SEGMENTS = ["기간", "시작일", "종료일"] as const;
const ACTIVE_SEGMENT = "기간";

export function MyWorkCalendarPanel() {
  const { user } = useSession();
  const { groups } = useProjectStore();
  const boards = useBoardState();

  // 보고 있는 달의 1일. 오늘 판정은 렌더 시점의 실제 날짜로 한다.
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const grid = useMemo(
    () => buildMonthGrid(monthAnchor, new Date()),
    [monthAnchor],
  );

  // "내 작업" 기준 — 작업 현황·사이드바와 같은 소유자 판정을 따른다.
  const myProjects = useMemo(
    () =>
      groups
        .flatMap((group) => group.projects)
        .filter((project) => project.ownerId === user?.id),
    [groups, user?.id],
  );

  const source = useMemo(
    () => buildCalendarSource(grid, myProjects, boards),
    [grid, myProjects, boards],
  );

  const layouts = useMemo(
    () => buildWeekLayouts(source.overlays, grid.weekCount),
    [source.overlays, grid.weekCount],
  );

  const [detailStage, setDetailStage] = useState<{
    projectId: string;
    stageId: string;
  } | null>(null);

  const detailProject = detailStage
    ? myProjects.find((project) => project.id === detailStage.projectId)
    : undefined;

  function shiftMonth(amount: number) {
    setMonthAnchor(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + amount, 1),
    );
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2.5">
        <button
          type="button"
          aria-label="이전 달"
          onClick={() => shiftMonth(-1)}
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ◀
        </button>
        <h2 className="text-[15px] font-semibold">{grid.title}</h2>
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
        <div className="ml-auto flex items-center rounded-[8px] border p-[3px]">
          {RANGE_SEGMENTS.map((segment) => (
            <button
              key={segment}
              type="button"
              aria-pressed={segment === ACTIVE_SEGMENT}
              className={cn(
                "rounded-[6px] px-2.5 py-[3px] text-xs font-medium transition-colors",
                segment === ACTIVE_SEGMENT
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {segment}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            const today = new Date();
            setMonthAnchor(new Date(today.getFullYear(), today.getMonth(), 1));
          }}
          className="rounded-[8px] border px-2.5 py-[5px] text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          오늘
        </button>
      </div>
      <MyWorkCalendar
        grid={grid}
        layouts={layouts}
        projects={source.projects}
        onOpenStage={(projectId, stageId) =>
          setDetailStage({ projectId, stageId })
        }
      />
      {detailStage && (
        <StageDetailOverlay
          projectId={detailStage.projectId}
          projectName={detailProject?.name ?? ""}
          projectColor={detailProject?.color ?? "#71717a"}
          stageId={detailStage.stageId}
          onOpenChange={(open) => {
            if (!open) setDetailStage(null);
          }}
        />
      )}
    </>
  );
}
