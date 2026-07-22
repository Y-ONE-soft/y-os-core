"use client";

import { useState } from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/components/features/projects/project-store";
import { useProjectBoard } from "@/components/features/projects/board-store";
import { ProjectRoadmap } from "@/components/features/projects/project-roadmap";
import { ProjectBoard } from "@/components/features/projects/project-board";
import { ProjectBacklog } from "@/components/features/projects/project-backlog";
import { StageAddOverlay } from "@/components/features/projects/stage-add-overlay";
import { StageDetailOverlay } from "@/components/features/projects/stage-detail-overlay";
import { PresetSaveDialog } from "@/components/features/presets/preset-save-dialog";
import { PresetApplyDialog } from "@/components/features/presets/preset-apply-dialog";

const TABS = ["보드", "할일", "리포트", "산출물", "메모", "문의"] as const;
const ACTIVE_TAB = "보드";

export function ProjectDetailPage({ projectId }: { projectId: string }) {
  const { groups } = useProjectStore();
  const { stages } = useProjectBoard(projectId);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetApplyOpen, setPresetApplyOpen] = useState(false);
  const [detailStageId, setDetailStageId] = useState<string | null>(null);
  const project = groups
    .flatMap((group) => group.projects)
    .find((candidate) => candidate.id === projectId);

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-muted-foreground">
          프로젝트를 찾을 수 없습니다.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/projects">작업 현황으로 돌아가기</Link>
        </Button>
      </div>
    );
  }

  const allTasks = stages.flatMap((stage) => stage.tasks);
  const progress =
    allTasks.length === 0
      ? 0
      : Math.round(
          (allTasks.filter((task) => task.done).length / allTasks.length) * 100,
        );
  const openStageDialog = () => setStageDialogOpen(true);
  // 프리셋 적용은 빈 프로젝트에만 허용한다(서버도 같은 규칙으로 최종 판정).
  // 반대로 저장은 저장할 구성이 있어야 의미가 있다.
  const hasStages = stages.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 p-6">
      {/* 액션 배치는 내 할일 헤더(ProjectCreateButton)와 같은 자리 — 제목 블록 좌측, 버튼 우측 */}
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="rounded-[6px] bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
              {project.name}
            </span>
            <span aria-hidden className="text-xs text-muted-foreground">
              ›
            </span>
            <span className="text-xs text-muted-foreground">
              고객 Y.ONE 내부
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <h1 className="text-xl font-semibold">{project.name}</h1>
          </div>
          <p className="text-[13px] text-muted-foreground">진행률 {progress}%</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={hasStages}
            title={
              hasStages
                ? "이미 단계가 있어 프리셋을 적용할 수 없습니다"
                : undefined
            }
            onClick={() => setPresetApplyOpen(true)}
          >
            <SlidersHorizontal className="size-4" />
            프리셋 사용하기
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!hasStages}
            title={
              hasStages ? undefined : "저장할 단계 구성이 없습니다"
            }
            onClick={() => setPresetDialogOpen(true)}
          >
            프리셋 저장하기
          </Button>
        </div>
      </header>
      <nav aria-label="프로젝트 상세 탭" className="shrink-0">
        <ul className="flex items-center gap-1">
          {TABS.map((tab) => {
            const active = tab === ACTIVE_TAB;
            return (
              <li key={tab}>
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "rounded-[6px] px-3.5 py-[7px] text-[13px] font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex min-h-0 flex-1 items-stretch gap-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <ProjectRoadmap
            projectId={projectId}
            onAddStage={openStageDialog}
            onOpenStage={setDetailStageId}
          />
          <ProjectBoard
            projectId={projectId}
            onAddStage={openStageDialog}
            onOpenStage={setDetailStageId}
          />
        </div>
        <ProjectBacklog projectId={projectId} />
      </div>
      <StageAddOverlay
        projectId={projectId}
        projectName={project.name}
        projectColor={project.color}
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
      />
      {presetDialogOpen && (
        <PresetSaveDialog
          projectId={projectId}
          onClose={() => setPresetDialogOpen(false)}
        />
      )}
      {presetApplyOpen && (
        <PresetApplyDialog
          projectId={projectId}
          onClose={() => setPresetApplyOpen(false)}
        />
      )}
      <StageDetailOverlay
        projectId={projectId}
        projectName={project.name}
        projectColor={project.color}
        stageId={detailStageId}
        onOpenChange={(open) => {
          if (!open) setDetailStageId(null);
        }}
      />
    </div>
  );
}
