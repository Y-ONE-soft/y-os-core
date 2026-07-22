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
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  boardActions,
  useProjectBoard,
} from "@/components/features/projects/board-store";
import { TaskDetailOverlay } from "@/components/features/projects/task-detail-overlay";
import { setTaskDragData } from "@/components/features/projects/task-drag";

// 내 할일 백로그와 같은 티켓 형태(할일명 클릭 → 상세, 소속 배지 드롭다운).
// 다만 이 화면은 프로젝트 스코프가 이미 정해져 있으므로 프로젝트는 바꾸지 않고
// 같은 프로젝트의 단계(또는 백로그 유지)만 지정한다.
export function ProjectBacklog({ projectId }: { projectId: string }) {
  const { backlog, stages } = useProjectBoard(projectId);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  return (
    <aside className="flex w-[300px] shrink-0 flex-col gap-2 rounded-[8px] border bg-background p-3.5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-1.5">
        <h2 className="text-[13.5px] font-semibold">백로그</h2>
        <span className="text-xs font-medium text-muted-foreground">
          {backlog.length}
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
                boardActions.addBacklogTask(projectId, name);
                event.currentTarget.value = "";
              }
            }
          }}
        />
      </div>
      {backlog.map((item) => (
        <ContextMenu key={item.id}>
          <ContextMenuTrigger asChild>
            {/* 항목 어디를 눌러도 상세가 열린다 — 체크박스·단계 지정은 예외 */}
            <div
              draggable
              onDragStart={(event) => setTaskDragData(event, item.id)}
              onClick={() => setDetailTaskId(item.id)}
              title="단계 컬럼으로 끌어다 놓으면 편입됩니다"
              className={cn(
                "flex shrink-0 cursor-grab items-center gap-2 rounded-[8px] bg-muted px-2.5 py-2 transition-colors hover:bg-accent/60 active:cursor-grabbing",
                // 완료 항목은 행 전체를 흐린다 — 보드 카드·내 할일 백로그와 같은 규칙
                item.done && "opacity-60 hover:opacity-80",
              )}
            >
              <span
                onClick={(event) => event.stopPropagation()}
                className="flex shrink-0 items-center"
              >
                <Checkbox
                  aria-label={`${item.name} 완료`}
                  checked={item.done}
                  onCheckedChange={() =>
                    boardActions.toggleTask(projectId, null, item.id)
                  }
                  className="rounded-[4px] border-primary bg-background"
                />
              </span>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setDetailTaskId(item.id);
                }}
                className={cn(
                  "min-w-0 flex-1 truncate text-left text-[13px] font-medium leading-[18px] underline-offset-2 hover:underline",
                  item.done && "text-muted-foreground line-through",
                )}
              >
                {item.name}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`${item.name} 단계 지정`}
                  onClick={(event) => event.stopPropagation()}
                  className="flex max-w-[104px] shrink-0 items-center gap-1 rounded-[6px] border bg-background px-1.5 py-0.5 text-[10.5px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <span className="truncate">백로그</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onSelect={() =>
                      boardActions.assignTask(
                        projectId,
                        item.id,
                        projectId,
                        null,
                      )
                    }
                  >
                    백로그
                    <Check aria-hidden className="ml-auto size-3.5" />
                  </DropdownMenuItem>
                  {stages.map((stage) => (
                    <DropdownMenuItem
                      key={stage.id}
                      onSelect={() =>
                        boardActions.assignTask(
                          projectId,
                          item.id,
                          projectId,
                          stage.id,
                        )
                      }
                    >
                      <span
                        aria-hidden
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="truncate">{stage.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-44">
            <ContextMenuItem
              variant="destructive"
              onSelect={() => boardActions.deleteTask(projectId, item.id)}
            >
              할일 삭제
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
      <p className="text-[11px] leading-normal text-muted-foreground">
        백로그 → 단계로 드래그하면 편입됩니다. 보드 카드를 이 영역으로
        드래그하면 백로그로 이동합니다.
      </p>
      <TaskDetailOverlay
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
      />
    </aside>
  );
}
