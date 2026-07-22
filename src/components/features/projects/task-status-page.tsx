"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/components/features/auth/session-context";
import { useProjectStore } from "@/components/features/projects/project-store";
import { useBoardState } from "@/components/features/projects/board-store";
import {
  WorkloadRoadmap,
  type RoadmapSection,
} from "@/components/features/projects/workload-roadmap";
import { StageDetailOverlay } from "@/components/features/projects/stage-detail-overlay";
import { TaskDetailOverlay } from "@/components/features/projects/task-detail-overlay";
import { TaskStatusCalendar } from "@/components/features/projects/task-status-calendar";
import { TaskStatusAssignees } from "@/components/features/projects/task-status-assignees";

const VIEW_OPTIONS = ["로드맵", "담당자", "캘린더"] as const;
type ViewOption = (typeof VIEW_OPTIONS)[number];
/** 아직 구현 전인 뷰 — 누를 수 있게 두면 빈 화면이 되므로 막아 둔다 */
const UNAVAILABLE_VIEWS: ViewOption[] = [];

function FilterChip({
  checked,
  onToggle,
  dotColor,
  label,
  count,
}: {
  checked: boolean;
  onToggle: () => void;
  dotColor?: string;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      className={cn(
        "flex h-[30px] items-center gap-2 rounded-full border px-2.5 text-[13px] font-medium transition-colors",
        checked
          ? "bg-background text-foreground"
          : "border-transparent bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {checked && (
        <span aria-hidden className="text-[10px] text-muted-foreground">
          ✓
        </span>
      )}
      {dotColor && (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
      )}
      {label}
      {count != null && (
        <span className="text-xs font-medium text-muted-foreground">
          {count}
        </span>
      )}
    </button>
  );
}

function toggleId(set: Set<string>, id: string) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function TaskStatusPage() {
  const { user, loading } = useSession();
  const { groups } = useProjectStore();
  const boardState = useBoardState();
  const [excludedGroupIds, setExcludedGroupIds] = useState<Set<string>>(
    new Set(),
  );
  const [excludedProjectIds, setExcludedProjectIds] = useState<Set<string>>(
    new Set(),
  );
  const [detailStage, setDetailStage] = useState<{
    projectId: string;
    stageId: string;
  } | null>(null);
  const [activeView, setActiveView] = useState<ViewOption>("로드맵");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex flex-col gap-3.5 p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full rounded-[12px]" />
        <Skeleton className="h-64 w-full rounded-[12px]" />
      </div>
    );
  }

  const isMaster = user?.role === "MASTER";

  const includedGroups = groups.filter(
    (group) => !excludedGroupIds.has(group.id),
  );
  const projectChipPool = isMaster
    ? includedGroups.flatMap((group) => group.projects)
    : groups
        .flatMap((group) => group.projects)
        .filter((project) => !!user && project.ownerId === user.id);

  const sections: RoadmapSection[] = isMaster
    ? includedGroups.map((group) => ({
        key: group.id,
        groupName: group.name,
        projects: group.projects.filter(
          (project) => !excludedProjectIds.has(project.id),
        ),
      }))
    : [
        {
          key: "assigned",
          groupName: null,
          projects: projectChipPool.filter(
            (project) => !excludedProjectIds.has(project.id),
          ),
        },
      ];

  const visibleProjects = sections.flatMap((section) => section.projects);
  const taskCount = visibleProjects.reduce(
    (sum, project) =>
      sum +
      (boardState[project.id]?.stages.reduce(
        (stageSum, stage) => stageSum + stage.tasks.length,
        0,
      ) ?? 0),
    0,
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 overflow-y-auto p-6">
      <header className="flex shrink-0 flex-col gap-1">
        <h1 className="text-xl font-semibold">작업 현황</h1>
        <p className="text-[13px] text-muted-foreground">
          그룹·프로젝트를 골라 선택 범위의 로드맵을 봅니다
        </p>
      </header>
      <section
        aria-label="선택 필터"
        className="flex shrink-0 flex-col gap-2.5 rounded-[12px] border bg-background px-[18px] py-3.5"
      >
        {isMaster && (
          <div className="flex items-center gap-3">
            <span className="w-[52px] shrink-0 text-[13px] text-muted-foreground">
              그룹
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {groups.map((group) => (
                <FilterChip
                  key={group.id}
                  checked={!excludedGroupIds.has(group.id)}
                  onToggle={() =>
                    setExcludedGroupIds((prev) => toggleId(prev, group.id))
                  }
                  label={group.name}
                  count={group.projects.length}
                />
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="w-[52px] shrink-0 text-[13px] text-muted-foreground">
            프로젝트
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {projectChipPool.map((project) => (
              <FilterChip
                key={project.id}
                checked={!excludedProjectIds.has(project.id)}
                onToggle={() =>
                  setExcludedProjectIds((prev) => toggleId(prev, project.id))
                }
                dotColor={project.color}
                label={project.name}
              />
            ))}
          </div>
        </div>
      </section>
      <div className="flex shrink-0 items-center justify-between">
        <p className="text-[13px] font-medium">
          선택: {visibleProjects.length}개 프로젝트 · {taskCount}개 할일
        </p>
        <div className="flex items-center gap-1">
          {VIEW_OPTIONS.map((view) => {
            const unavailable = UNAVAILABLE_VIEWS.includes(view);
            return (
              <button
                key={view}
                type="button"
                aria-pressed={view === activeView}
                disabled={unavailable}
                title={unavailable ? "준비 중입니다" : undefined}
                onClick={() => setActiveView(view)}
                className={cn(
                  "rounded-[6px] px-3 py-[5px] text-[12.5px] font-medium transition-colors",
                  view === activeView
                    ? "border bg-background text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                  unavailable && "cursor-not-allowed opacity-50 hover:text-muted-foreground",
                )}
              >
                {view}
              </button>
            );
          })}
        </div>
      </div>
      {activeView === "담당자" ? (
        <TaskStatusAssignees
          projects={visibleProjects}
          isMaster={isMaster}
          currentUserId={user?.id ?? null}
        />
      ) : activeView === "캘린더" ? (
        <TaskStatusCalendar
          projects={visibleProjects}
          onOpenStage={(projectId, stageId) =>
            setDetailStage({ projectId, stageId })
          }
          onOpenTask={setDetailTaskId}
        />
      ) : (
        <WorkloadRoadmap
          sections={sections}
          onOpenStage={(projectId, stageId) =>
            setDetailStage({ projectId, stageId })
          }
        />
      )}
      {detailStage && (
        <StageDetailOverlay
          projectId={detailStage.projectId}
          projectName={
            visibleProjects.find(
              (project) => project.id === detailStage.projectId,
            )?.name ?? ""
          }
          projectColor={
            visibleProjects.find(
              (project) => project.id === detailStage.projectId,
            )?.color ?? "#71717a"
          }
          stageId={detailStage.stageId}
          onOpenChange={(open) => {
            if (!open) setDetailStage(null);
          }}
        />
      )}
      <TaskDetailOverlay
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
      />
    </div>
  );
}
