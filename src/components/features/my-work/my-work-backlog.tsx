"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjectStore } from "@/components/features/projects/project-store";
import {
  boardActions,
  useBoardState,
} from "@/components/features/projects/board-store";
import { TaskDetailOverlay } from "@/components/features/projects/task-detail-overlay";

// 내 작업 페이지는 프로젝트 스코프가 없으므로 전 프로젝트 백로그를 통합해 보여준다.
// 데이터 원본은 프로젝트 상세의 백로그와 동일한 보드 스토어(DB).
// 새 작업은 첫 프로젝트 백로그로 들어가며, 프로젝트는 작업 상세(티켓)에서 바꾼다.
export function MyWorkBacklog() {
  const { groups } = useProjectStore();
  const boards = useBoardState();
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const projects = groups.flatMap((group) => group.projects);
  const items = projects.flatMap((project) =>
    (boards[project.id]?.backlog ?? []).map((task) => ({ project, task })),
  );
  const defaultProjectId = projects[0]?.id ?? null;

  return (
    <aside className="flex w-[300px] shrink-0 flex-col gap-2 self-stretch overflow-y-auto rounded-[8px] border bg-background p-3.5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-1.5">
        <h2 className="text-[13.5px] font-semibold">백로그</h2>
        <span className="text-xs font-medium text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div className="flex h-8 shrink-0 items-center rounded-[8px] bg-muted px-2.5 focus-within:ring-1 focus-within:ring-primary">
        <input
          placeholder="＋ 작업 이름 입력 후 Enter"
          aria-label="백로그 작업 추가"
          disabled={!defaultProjectId}
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          onKeyDown={(event) => {
            if (event.key === "Enter" && defaultProjectId) {
              const name = event.currentTarget.value.trim();
              if (name) {
                boardActions.addBacklogTask(defaultProjectId, name);
                event.currentTarget.value = "";
              }
            }
          }}
        />
      </div>
      {items.map(({ project, task }) => (
        <ContextMenu key={task.id}>
          <ContextMenuTrigger asChild>
            <div className="flex shrink-0 items-center gap-2 rounded-[8px] bg-muted px-2.5 py-2">
              <Checkbox
                aria-label={`${task.name} 완료`}
                checked={task.done}
                onCheckedChange={() =>
                  boardActions.toggleTask(project.id, null, task.id)
                }
                className="rounded-[4px] border-primary bg-background"
              />
              <button
                type="button"
                onClick={() => setDetailTaskId(task.id)}
                className={cn(
                  "min-w-0 flex-1 truncate text-left text-[13px] font-medium leading-[18px] underline-offset-2 hover:underline",
                  task.done && "text-muted-foreground line-through",
                )}
              >
                {task.name}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`${task.name} 소속 변경`}
                  className="flex max-w-[104px] shrink-0 items-center gap-1 rounded-[6px] border bg-background px-1.5 py-0.5 text-[10.5px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate">{project.name} · 백로그</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {projects.map((candidate) => (
                    <DropdownMenuGroup key={candidate.id}>
                      <DropdownMenuLabel className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span
                          aria-hidden
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: candidate.color }}
                        />
                        <span className="truncate">{candidate.name}</span>
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onSelect={() =>
                          boardActions.assignTask(
                            project.id,
                            task.id,
                            candidate.id,
                            null,
                          )
                        }
                      >
                        백로그
                        {candidate.id === project.id && (
                          <Check aria-hidden className="ml-auto size-3.5" />
                        )}
                      </DropdownMenuItem>
                      {(boards[candidate.id]?.stages ?? []).map((stage) => (
                        <DropdownMenuItem
                          key={stage.id}
                          onSelect={() =>
                            boardActions.assignTask(
                              project.id,
                              task.id,
                              candidate.id,
                              stage.id,
                            )
                          }
                        >
                          {stage.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-44">
            <ContextMenuItem
              variant="destructive"
              onSelect={() => boardActions.deleteTask(project.id, task.id)}
            >
              작업 삭제
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
      <p className="text-[11px] leading-normal text-muted-foreground">
        백로그를 날짜 칸으로 드래그하면 일정이 잡힙니다.
      </p>
      <TaskDetailOverlay
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
      />
    </aside>
  );
}
