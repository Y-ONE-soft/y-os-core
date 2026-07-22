"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Project } from "@/components/features/projects/project-store";
import { useBoardState } from "@/components/features/projects/board-store";
import { ROADMAP } from "@/components/features/projects/project-detail-data";
import {
  barRange,
  formatShort,
  hexToRgba,
} from "@/components/features/projects/roadmap-utils";

const RANGE_OPTIONS = ["오늘", "일", "주", "개월", "분기"] as const;
const ACTIVE_RANGE = "주";

export type RoadmapSection = {
  key: string;
  /** null이면 그룹 헤더 행 없이 플랫하게 표시 (스탭 뷰) */
  groupName: string | null;
  projects: Project[];
};

function Bar({
  color,
  startDate,
  endDate,
  label,
}: {
  color: string;
  startDate: string;
  endDate?: string;
  label: string;
}) {
  const { startDay, days } = barRange(
    ROADMAP.start,
    ROADMAP.days,
    startDate,
    endDate,
  );
  if (days <= 0) return null;
  return (
    <div
      className="absolute top-1 flex h-[18px] items-center overflow-hidden rounded-[6px] border pl-2"
      style={{
        left: `${(startDay / ROADMAP.days) * 100}%`,
        width: `${(days / ROADMAP.days) * 100}%`,
        backgroundColor: hexToRgba(color, 0.12),
        borderColor: hexToRgba(color, 0.8),
      }}
    >
      <span
        className="whitespace-nowrap text-[10.5px] font-medium"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}

export function WorkloadRoadmap({ sections }: { sections: RoadmapSection[] }) {
  const boardState = useBoardState();
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) =>
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="w-full rounded-[12px] border bg-background shadow-[0px_1px_3px_0px_rgba(0,0,0,0.05)]">
      <header className="flex items-center justify-between py-2.5 pl-4 pr-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[13.5px] font-semibold">로드맵</h2>
          <p className="text-[11.5px] text-muted-foreground">
            단계 막대 드래그로 기간 조절
          </p>
        </div>
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
      </header>
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-[200px] right-0"
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
        <div className="flex h-[26px] items-center border-t text-[10.5px] font-medium text-muted-foreground">
          <div className="w-[200px] shrink-0 pl-4">프로젝트 · 단계</div>
          <div className="grid min-w-0 flex-1 grid-cols-4">
            {ROADMAP.ticks.map((tick) => (
              <div key={tick} className="pl-1.5">
                {tick}
              </div>
            ))}
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
                    className="flex w-[200px] shrink-0 items-center gap-1.5 pl-4 pr-2.5 text-left"
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
                    ? dated
                        .map((stage) => stage.startDate!)
                        .sort()[0]
                    : null;
                  const ends = dated
                    .map((stage) => stage.endDate ?? stage.startDate!)
                    .sort();
                  const projectEnd = ends.length ? ends[ends.length - 1] : null;
                  return (
                    <div key={project.id}>
                      <div className="flex h-[26px] items-stretch border-t">
                        <div className="flex w-[200px] shrink-0 items-center gap-1.5 pl-4 pr-2.5">
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                            {project.name}
                          </span>
                        </div>
                        <div className="relative min-w-0 flex-1">
                          {projectStart && (
                            <Bar
                              color={project.color}
                              startDate={projectStart}
                              endDate={projectEnd ?? undefined}
                              label={`전체 ${overallPercent}%`}
                            />
                          )}
                        </div>
                      </div>
                      {stages.map((stage) => {
                        const done = stage.tasks.filter(
                          (task) => task.done,
                        ).length;
                        const total = stage.tasks.length;
                        const percent =
                          total === 0 ? 0 : Math.round((done / total) * 100);
                        const showBar = Boolean(
                          stage.showDeadline && stage.startDate,
                        );
                        return (
                          <div
                            key={stage.id}
                            className="flex h-[26px] items-stretch border-t"
                          >
                            <div className="flex w-[200px] shrink-0 items-center gap-1.5 pl-7 pr-2.5">
                              <span
                                aria-hidden
                                className="size-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: stage.color }}
                              />
                              <span className="min-w-0 flex-1 truncate text-xs">
                                {stage.name}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {done}/{total}
                              </span>
                            </div>
                            <div className="relative min-w-0 flex-1">
                              {showBar && (
                                <Bar
                                  color={stage.color}
                                  startDate={stage.startDate!}
                                  endDate={stage.endDate}
                                  label={
                                    stage.endDate
                                      ? `${percent}% · ${formatShort(stage.startDate!)}~${formatShort(stage.endDate)}`
                                      : `${percent}% · ${formatShort(stage.startDate!)}~`
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
    </section>
  );
}
