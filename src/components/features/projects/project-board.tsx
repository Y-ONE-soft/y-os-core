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
import { RowActions } from "@/components/ui/row-actions";
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
import {
  getStageDragData,
  isStageDrag,
  setStageDragData,
} from "@/components/features/projects/stage-drag";

/** 맨 뒤로 보내는 드롭 자리 — 단계 id와 겹치지 않는 표식 */
const END_SLOT = "__end__";

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
  // 단계 순서 변경 드래그 — 끌고 있는 컬럼과 끼워 넣을 자리
  const [draggingStageId, setDraggingStageId] = useState<string | null>(null);
  const [orderTargetId, setOrderTargetId] = useState<string | null>(null);

  const endStageDrag = () => {
    setDraggingStageId(null);
    setOrderTargetId(null);
  };

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
              // 컬럼은 두 종류의 드래그를 받는다 — 할일은 편입, 단계는 순서 변경
              if (isStageDrag(event)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setOrderTargetId(stage.id);
                return;
              }
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
              setOrderTargetId((prev) => (prev === stage.id ? null : prev));
            }}
            onDrop={(event) => {
              const movedStageId = getStageDragData(event);
              if (movedStageId) {
                event.preventDefault();
                endStageDrag();
                // 끌어온 단계가 이 컬럼 자리를 차지하고, 이 컬럼부터 뒤로 밀린다
                boardActions.moveStage(projectId, movedStageId, stage.id);
                return;
              }
              const taskId = getTaskDragData(event);
              setDropStageId(null);
              if (!taskId) return;
              event.preventDefault();
              // 백로그·다른 단계 어디서 왔든 이 단계로 편입한다.
              // 예정일은 assignTask가 max(단계 시작일, 오늘)로 잡아 준다.
              boardActions.assignTask(projectId, taskId, projectId, stage.id);
            }}
            onClick={() => onOpenStage(stage.id)}
            className={cn(
              "relative flex min-h-0 w-[260px] shrink-0 cursor-pointer flex-col gap-1.5 rounded-[8px] bg-border p-2 transition-shadow",
              // 컬럼 전체가 '단계' 컴포넌트다 — 호버하면 통째로 선택된 것처럼 보인다.
              // 단, 안쪽 카드·버튼을 가리키는 동안에는 컬럼 강조를 끈다(has-*가
              // :has() 특이도 덕에 hover 유틸리티를 순서와 무관하게 이긴다).
              "hover:ring-2 hover:ring-primary/40 has-[[data-column-child]:hover]:ring-0",
              dropStageId === stage.id &&
                "ring-2 ring-primary ring-offset-1 has-[[data-column-child]:hover]:ring-2",
              draggingStageId === stage.id && "opacity-40",
            )}
          >
            {/* 끼워 넣을 자리 — 이 컬럼 왼쪽에 들어간다 */}
            {orderTargetId === stage.id && draggingStageId !== stage.id && (
              <span
                aria-hidden
                className="absolute inset-y-0 -left-[7px] w-[3px] rounded-full bg-primary"
              />
            )}
            {/* 단계 메뉴는 헤더 우클릭 — 할일 카드·프로젝트·백로그와 같은 방식.
                컬럼 전체를 트리거로 잡으면 할일 카드 메뉴와 중첩되므로 헤더만 잡는다 */}
            <ContextMenu>
              <ContextMenuTrigger asChild>
                {/* 순서 변경 손잡이 — 카드 영역까지 draggable로 잡으면 할일 카드
                    드래그와 겹치므로 손잡이는 헤더로 한정한다.
                    클릭·호버 반응은 주지 않는다: 상세 열기와 강조는 컬럼 전체가 맡고,
                    헤더에만 배경이 깔리면 "헤더를 눌러야 하나"로 읽힌다 */}
                <header
                  draggable
                  onDragStart={(event) => {
                    setStageDragData(event, stage.id);
                    setDraggingStageId(stage.id);
                  }}
                  onDragEnd={endStageDrag}
                  className="flex shrink-0 cursor-grab items-center gap-[7px] py-0.5 pl-1 pr-0.5 active:cursor-grabbing"
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                    {stage.name}
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
                    {/* 카드 자체가 하나의 '할일' 컴포넌트 — 호버하면 선택된 것처럼
                        보이고 어디를 눌러도 상세가 열린다(체크박스만 예외).
                        완료 카드는 컬럼 배경에 잠기고 그림자를 잃어 뒤로 물러난다 —
                        글자 취소선만으로는 한눈에 구분되지 않았다 */}
                    <div
                      data-column-child
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        // 막지 않으면 컬럼까지 올라가 단계 상세가 같이 열린다
                        event.stopPropagation();
                        setDetailTaskId(task.id);
                      }}
                      onKeyDown={(event) => {
                        // div라 기본 동작이 없으니 버튼 규약을 직접 지킨다
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          setDetailTaskId(task.id);
                        }
                      }}
                      className={cn(
                        "group flex w-full shrink-0 cursor-pointer items-center gap-2 rounded-[8px] px-2.5 py-2 transition-shadow outline-none",
                        "hover:ring-2 hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-ring",
                        task.done
                          ? "bg-muted opacity-60"
                          : "bg-background shadow-xs",
                      )}
                    >
                      <span
                        onClick={(event) => event.stopPropagation()}
                        className="flex shrink-0 items-center"
                      >
                        <Checkbox
                          aria-label={`${task.name} 완료`}
                          checked={task.done}
                          onCheckedChange={() =>
                            boardActions.toggleTask(
                              projectId,
                              stage.id,
                              task.id,
                            )
                          }
                          className="rounded-[4px] border-primary"
                        />
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-left text-[13px] font-medium leading-[18px]",
                          task.done && "text-muted-foreground line-through",
                        )}
                      >
                        {task.name}
                      </span>
                      <RowActions
                        label={task.name}
                        actions={[
                          {
                            label: "할일 삭제",
                            destructive: true,
                            onSelect: () =>
                              boardActions.deleteTask(projectId, task.id),
                          },
                        ]}
                      />
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-44">
                    <ContextMenuItem
                      variant="destructive"
                      onSelect={() =>
                        boardActions.deleteTask(projectId, task.id)
                      }
                    >
                      할일 삭제
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
              {addingStageId === stage.id ? (
                <div
                  data-column-child
                  onClick={(event) => event.stopPropagation()}
                  className="flex w-full shrink-0 items-center gap-2 rounded-[8px] border-[1.5px] border-primary bg-background px-2.5 py-2 shadow-xs"
                >
                  <input
                    autoFocus
                    placeholder="할일명 입력 후 Enter"
                    aria-label={`${stage.name} 할일 추가`}
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
                  data-column-child
                  onClick={(event) => {
                    event.stopPropagation();
                    setAddingStageId(stage.id);
                  }}
                  className="flex w-full shrink-0 items-center rounded-[8px] py-[5px] pl-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
                >
                  ＋ 할일
                </button>
              )}
            </div>
          </section>
        );
      })}
      {/* Figma 113:452 "단계 추가 (대기)" — 마지막 컬럼 자리의 점선 진입점.
          맨 뒤로 보내는 드롭 자리도 겸한다 */}
      <button
        type="button"
        onClick={onAddStage}
        onDragOver={(event) => {
          if (!isStageDrag(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setOrderTargetId(END_SLOT);
        }}
        onDragLeave={() =>
          setOrderTargetId((prev) => (prev === END_SLOT ? null : prev))
        }
        onDrop={(event) => {
          const movedStageId = getStageDragData(event);
          endStageDrag();
          if (!movedStageId) return;
          event.preventDefault();
          boardActions.moveStage(projectId, movedStageId, null);
        }}
        className={cn(
          "flex w-[260px] shrink-0 flex-col items-center justify-center rounded-[8px] border border-dashed p-2 text-center text-[12.5px] font-medium leading-5 text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground",
          orderTargetId === END_SLOT && "border-primary text-foreground",
        )}
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
