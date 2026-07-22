"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/components/features/projects/project-store";
import { ProjectRoadmap } from "@/components/features/projects/project-roadmap";
import { ProjectBoard } from "@/components/features/projects/project-board";
import { ProjectBacklog } from "@/components/features/projects/project-backlog";

const TABS = ["보드", "작업", "리포트", "산출물", "메모", "문의"] as const;
const ACTIVE_TAB = "보드";

export function ProjectDetailPage({ projectId }: { projectId: string }) {
  const { groups } = useProjectStore();
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

  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 p-6">
      <header className="flex shrink-0 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="rounded-[6px] bg-background px-2 py-0.5 text-[11px] font-medium">
            {project.name}
          </span>
          <span aria-hidden className="text-xs text-muted-foreground">
            ›
          </span>
          <span className="text-xs text-muted-foreground">고객 Y.ONE 내부</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: project.color }}
          />
          <h1 className="text-xl font-semibold">{project.name}</h1>
        </div>
        <p className="text-[13px] text-muted-foreground">진행률 0%</p>
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
                    "rounded-full px-3.5 py-[7px] text-[13px] font-medium transition-colors",
                    active
                      ? "bg-background text-foreground"
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
          <ProjectRoadmap />
          <ProjectBoard />
        </div>
        <ProjectBacklog />
      </div>
    </div>
  );
}
