"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectStore } from "@/components/features/projects/project-store";
import {
  boardActions,
  useBoardState,
} from "@/components/features/projects/board-store";
import { TaskDetailOverlay } from "@/components/features/projects/task-detail-overlay";

// 내 작업 페이지는 프로젝트 스코프가 없으므로 전 프로젝트 백로그를 통합해 보여준다.
// 데이터 원본은 프로젝트 상세의 백로그와 동일한 보드 스토어(DB).
export function MyWorkBacklog() {
  const { groups } = useProjectStore();
  const boards = useBoardState();
  const [addProjectId, setAddProjectId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    projectId: string;
    taskId: string;
  } | null>(null);

  const projects = groups.flatMap((group) => group.projects);
  const items = projects.flatMap((project) =>
    (boards[project.id]?.backlog ?? []).map((task) => ({ project, task })),
  );
  const targetProjectId = addProjectId ?? projects[0]?.id ?? null;

  return (
    <aside className="flex w-[300px] shrink-0 flex-col gap-2 self-stretch overflow-y-auto rounded-[8px] border bg-background p-3.5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-1.5">
        <h2 className="text-[13.5px] font-semibold">백로그</h2>
        <span className="text-xs font-medium text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Select
          value={targetProjectId ?? undefined}
          onValueChange={setAddProjectId}
        >
          <SelectTrigger
            aria-label="추가할 프로젝트"
            className="h-8 w-[100px] shrink-0 rounded-[8px] border-none bg-muted text-xs"
          >
            <SelectValue placeholder="프로젝트" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex h-8 min-w-0 flex-1 items-center rounded-[8px] bg-muted px-2.5 focus-within:ring-1 focus-within:ring-primary">
          <input
            placeholder="＋ 작업 이름 입력 후 Enter"
            aria-label="백로그 작업 추가"
            disabled={!targetProjectId}
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            onKeyDown={(event) => {
              if (event.key === "Enter" && targetProjectId) {
                const name = event.currentTarget.value.trim();
                if (name) {
                  boardActions.addBacklogTask(targetProjectId, name);
                  event.currentTarget.value = "";
                }
              }
            }}
          />
        </div>
      </div>
      {items.map(({ project, task }) => (
        <div
          key={task.id}
          className="flex shrink-0 items-center gap-2 rounded-[8px] bg-muted px-2.5 py-2"
        >
          <Checkbox
            aria-label={`${task.name} 완료`}
            checked={task.done}
            onCheckedChange={() =>
              boardActions.toggleTask(project.id, null, task.id)
            }
            className="rounded-[4px] border-primary bg-background"
          />
          <span
            aria-hidden
            title={project.name}
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: project.color }}
          />
          <button
            type="button"
            onClick={() => setDetail({ projectId: project.id, taskId: task.id })}
            className={cn(
              "min-w-0 flex-1 truncate text-left text-[13px] font-medium leading-[18px] underline-offset-2 hover:underline",
              task.done && "text-muted-foreground line-through",
            )}
          >
            {task.name}
          </button>
        </div>
      ))}
      <p className="text-[11px] leading-normal text-muted-foreground">
        백로그를 날짜 칸으로 드래그하면 일정이 잡힙니다.
      </p>
      {detail && (
        <TaskDetailOverlay
          projectId={detail.projectId}
          taskId={detail.taskId}
          onClose={() => setDetail(null)}
        />
      )}
    </aside>
  );
}
