"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  boardActions,
  useProjectBoard,
} from "@/components/features/projects/board-store";
import { TaskDetailOverlay } from "@/components/features/projects/task-detail-overlay";
import { formatShort } from "@/components/features/projects/roadmap-utils";
import {
  getTaskDragData,
  isTaskDrag,
} from "@/components/features/projects/task-drag";

export function ProjectBoard({
  projectId,
  onAddStage,
  onOpenStage,
}: {
  projectId: string;
  onAddStage: () => void;
  onOpenStage: (stageId: string) => void;
}) {
  const { stages } = useProjectBoard(projectId);
  const [addingStageId, setAddingStageId] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  // 드롭 대상으로 잡힌 컬럼 — 어디에 놓이는지 보이게 하이라이트한다
  const [dropStageId, setDropStageId] = useState<string | null>(null);

  return (
    <div className="flex min-h-0 flex-1 gap-2.5 overflow-x-auto">
      {stages.map((stage) => {
        // 기간이 있으면 항상 표기한다 — 데드라인 표시는 캘린더 마감 라벨 전용
        const countLabel = stage.startDate
          ? `${formatShort(stage.startDate)}~${stage.endDate ? formatShort(stage.endDate) : ""} · ${stage.tasks.length}`
          : `${stage.tasks.length}`;
        return (
          <section
            key={stage.id}
            onDragOver={(event) => {
              if (!isTaskDrag(event)) return;
              event.preventDefault(); // 기본값은 '드롭 금지'라 막아줘야 놓을 수 있다
              event.dataTransfer.dropEffect = "move";
              setDropStageId(stage.id);
            }}
            onDragLeave={(event) => {
              // 자식 위로 옮겨갈 때도 leave가 뜨므로 컬럼 밖으로 나갔을 때만 끈다
              if (event.currentTarget.contains(event.relatedTarget as Node)) {
                return;
              }
              setDropStageId((prev) => (prev === stage.id ? null : prev));
            }}
            onDrop={(event) => {
              const taskId = getTaskDragData(event);
              setDropStageId(null);
              if (!taskId) return;
              event.preventDefault();
              // 백로그·다른 단계 어디서 왔든 이 단계로 편입한다.
              // 예정일은 assignTask가 max(단계 시작일, 오늘)로 잡아 준다.
              boardActions.assignTask(projectId, taskId, projectId, stage.id);
            }}
            className={cn(
              "flex min-h-0 w-[260px] shrink-0 flex-col gap-1.5 rounded-[8px] bg-border p-2 transition-shadow",
              dropStageId === stage.id && "ring-2 ring-primary ring-offset-1",
            )}
          >
            {/* 단계 메뉴는 헤더 우클릭 — 작업 카드·프로젝트·백로그와 같은 방식.
                컬럼 전체를 트리거로 잡으면 작업 카드 메뉴와 중첩되므로 헤더만 잡는다 */}
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <header className="flex shrink-0 items-center gap-[7px] py-0.5 pl-1 pr-0.5">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                    <button
                      type="button"
                      onClick={() => onOpenStage(stage.id)}
                      className="max-w-full truncate text-left transition-colors hover:text-primary/80 hover:underline"
                    >
                      {stage.name}
                    </button>
                  </h3>
                  <span className="rounded-full bg-background px-[7px] py-0.5 text-[10.5px] text-muted-foreground">
                    {countLabel}
                  </span>
                </header>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-44">
                <ContextMenuItem
                  variant="destructive"
                  onSelect={() => boardActions.deleteStage(projectId, stage.id)}
                >
                  단계 삭제
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            {/* 카드 영역만 스크롤 — 컬럼 자체는 보드 높이를 꽉 채운다 (Figma 260×448) */}
            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
              {stage.tasks.map((task) => (
                <ContextMenu key={task.id}>
                  <ContextMenuTrigger asChild>
                    {/* 완료 카드는 컬럼 배경에 잠기고 그림자를 잃어 뒤로 물러난다 —
                        글자 취소선만으로는 한눈에 구분되지 않았다 */}
                    <div
                      className={cn(
                        "flex w-full shrink-0 items-center gap-2 rounded-[8px] px-2.5 py-2",
                        task.done
                          ? "bg-muted opacity-60"
                          : "bg-background shadow-xs",
                      )}
                    >
                      <Checkbox
                        aria-label={`${task.name} 완료`}
                        checked={task.done}
                        onCheckedChange={() =>
                          boardActions.toggleTask(projectId, stage.id, task.id)
                        }
                        className="rounded-[4px] border-primary"
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
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-44">
                    <ContextMenuItem
                      variant="destructive"
                      onSelect={() =>
                        boardActions.deleteTask(projectId, task.id)
                      }
                    >
                      작업 삭제
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
              {addingStageId === stage.id ? (
                <div className="flex w-full shrink-0 items-center gap-2 rounded-[8px] border-[1.5px] border-primary bg-background px-2.5 py-2 shadow-xs">
                  <input
                    autoFocus
                    placeholder="작업명 입력 후 Enter"
                    aria-label={`${stage.name} 작업 추가`}
                    className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        const name = event.currentTarget.value.trim();
                        if (name)
                          boardActions.addTask(projectId, stage.id, name);
                        setAddingStageId(null);
                      }
                      if (event.key === "Escape") setAddingStageId(null);
                    }}
                    onBlur={() => setAddingStageId(null)}
                  />
                  <span
                    aria-hidden
                    className="text-[11px] text-muted-foreground"
                  >
                    ↵
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingStageId(stage.id)}
                  className="flex w-full shrink-0 items-center rounded-[8px] py-[5px] pl-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
                >
                  ＋ 작업
                </button>
              )}
            </div>
          </section>
        );
      })}
      {/* Figma 113:452 "단계 추가 (대기)" — 마지막 컬럼 자리의 점선 진입점 */}
      <button
        type="button"
        onClick={onAddStage}
        className="flex w-[260px] shrink-0 flex-col items-center justify-center rounded-[8px] border border-dashed p-2 text-center text-[12.5px] font-medium leading-5 text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground"
      >
        <span aria-hidden>＋</span>
        단계 추가
      </button>
      <TaskDetailOverlay
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
      />
    </div>
  );
}
