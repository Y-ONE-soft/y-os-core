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
import { RowActions } from "@/components/ui/row-actions";
import { useSession } from "@/components/features/auth/session-context";
import { useProjectStore } from "@/components/features/projects/project-store";
import {
  boardActions,
  useBoardState,
  useUnassignedTasks,
} from "@/components/features/projects/board-store";
import { TaskDetailOverlay } from "@/components/features/projects/task-detail-overlay";
import { setTaskDragData } from "@/components/features/projects/task-drag";
import { isMyTask } from "@/components/features/my-work/my-work-scope";

// 내 할일 페이지는 프로젝트 스코프가 없으므로 미배정 할일과 전 프로젝트 백로그를
// 함께 보여준다. 데이터 원본은 프로젝트 상세의 백로그와 동일한 보드 스토어(DB).
// 단, "내 작업"이므로 담당자가 나인 것만 — 남이 만든 백로그·미배정은 뺀다.
// 여기서 만든 할일은 원칙적으로 "프로젝트 없음"(미배정)이며, 소속은 행의
// 드롭다운 라벨이나 할일 티켓에서 정한다.
export function MyWorkBacklog() {
  const { user } = useSession();
  const { groups } = useProjectStore();
  const boards = useBoardState();
  const unassigned = useUnassignedTasks();
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const projects = groups.flatMap((group) => group.projects);
  const items = [
    ...unassigned.map((task) => ({ project: null, task })),
    ...projects.flatMap((project) =>
      (boards[project.id]?.backlog ?? []).map((task) => ({ project, task })),
    ),
  ].filter(({ task }) => isMyTask(task, user?.id));

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
          placeholder="＋ 할일 이름 입력 후 Enter"
          aria-label="백로그 할일 추가"
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              const name = event.currentTarget.value.trim();
              if (name) {
                // 프로젝트 없음이 기본 — 소속은 나중에 라벨·티켓에서 정한다.
                // 담당자는 나 — 안 넣으면 방금 만든 할일이 내 작업 필터에서 깜빡인다.
                boardActions.addUnassignedTask(name, user?.id);
                event.currentTarget.value = "";
              }
            }
          }}
        />
      </div>
      {items.map(({ project, task }) => (
        <ContextMenu key={task.id}>
          <ContextMenuTrigger asChild>
            {/* 완료 항목은 행 전체를 흐려 목록에서 뒤로 물러나게 한다 —
                보드 카드와 같은 규칙 (project-board.tsx) */}
            <div
              draggable
              onDragStart={(event) => setTaskDragData(event, task.id)}
              title="캘린더 날짜 칸으로 끌어다 놓으면 일정이 잡힙니다"
              className={cn(
                "group flex shrink-0 cursor-grab items-center gap-2 rounded-[8px] bg-muted px-2.5 py-2 active:cursor-grabbing",
                task.done && "opacity-60",
              )}
            >
              <Checkbox
                aria-label={`${task.name} 완료`}
                checked={task.done}
                onCheckedChange={() =>
                  boardActions.toggleTask(project?.id ?? null, null, task.id)
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
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      !project && "border border-muted-foreground/50",
                    )}
                    style={
                      project ? { backgroundColor: project.color } : undefined
                    }
                  />
                  <span className="truncate">
                    {project ? `${project.name} · 백로그` : "프로젝트 없음"}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onSelect={() =>
                      boardActions.assignTask(
                        project?.id ?? null,
                        task.id,
                        null,
                        null,
                      )
                    }
                  >
                    프로젝트 없음
                    {!project && (
                      <Check aria-hidden className="ml-auto size-3.5" />
                    )}
                  </DropdownMenuItem>
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
                            project?.id ?? null,
                            task.id,
                            candidate.id,
                            null,
                          )
                        }
                      >
                        백로그
                        {candidate.id === project?.id && (
                          <Check aria-hidden className="ml-auto size-3.5" />
                        )}
                      </DropdownMenuItem>
                      {(boards[candidate.id]?.stages ?? []).map((stage) => (
                        <DropdownMenuItem
                          key={stage.id}
                          onSelect={() =>
                            boardActions.assignTask(
                              project?.id ?? null,
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
              <RowActions
                label={task.name}
                actions={[
                  {
                    label: "할일 삭제",
                    destructive: true,
                    onSelect: () =>
                      boardActions.deleteTask(project?.id ?? null, task.id),
                  },
                ]}
              />
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-44">
            <ContextMenuItem
              variant="destructive"
              onSelect={() =>
                boardActions.deleteTask(project?.id ?? null, task.id)
              }
            >
              할일 삭제
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
