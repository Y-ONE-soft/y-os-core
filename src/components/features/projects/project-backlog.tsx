"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTypeToFocus } from "@/hooks/use-type-to-focus";
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
  setTaskDragData,
} from "@/components/features/projects/task-drag";
import type { BoardStage, BoardTask } from "@/types/workspace";

// 백로그 패널의 한 줄(할일 티켓). 단계 없음·백로그 두 섹션이 같은 티켓을 쓴다.
// 예정일이 있으면(=단계 없음) 날짜 배지를 함께 보여 백로그(미정)와 구분한다.
function BacklogRow({
  projectId,
  stages,
  item,
  onOpenDetail,
}: {
  projectId: string;
  stages: BoardStage[];
  item: BoardTask;
  onOpenDetail: (taskId: string) => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/* 항목 자체가 하나의 '할일' 컴포넌트 — 호버하면 선택된 것처럼 보이고
            어디를 눌러도 상세가 열린다(체크박스·단계 지정은 예외) */}
        <div
          draggable
          role="button"
          tabIndex={0}
          onDragStart={(event) => setTaskDragData(event, item.id)}
          onClick={() => onOpenDetail(item.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpenDetail(item.id);
            }
          }}
          title="단계 컬럼으로 끌어다 놓으면 편입됩니다"
          className={cn(
            "group flex shrink-0 cursor-grab items-center gap-2 rounded-[8px] bg-muted px-2.5 py-2 transition-shadow outline-none active:cursor-grabbing",
            "hover:ring-2 hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-ring",
            // 완료 항목은 행 전체를 흐린다 — 보드 카드·내 할일 백로그와 같은 규칙
            item.done && "opacity-60",
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
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-left text-[13px] font-medium leading-[18px]",
              item.done && "text-muted-foreground line-through",
            )}
          >
            {item.name}
          </span>
          {/* 예정일이 있으면(=단계 없음) 날짜를 배지로 — 백로그(미정)와 구분된다 */}
          {item.scheduledDate && (
            <span className="shrink-0 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {formatShort(item.scheduledDate)}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`${item.name} 단계 지정`}
              onClick={(event) => event.stopPropagation()}
              className="flex max-w-[104px] shrink-0 items-center gap-1 rounded-[6px] border bg-background px-1.5 py-0.5 text-[10.5px] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span className="truncate">
                {item.scheduledDate ? "단계 없음" : "백로그"}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {/* 백로그로 되돌리면 예정일도 함께 해제된다(assignTask 규칙) */}
              <DropdownMenuItem
                onSelect={() =>
                  boardActions.assignTask(projectId, item.id, projectId, null)
                }
              >
                백로그
                {!item.scheduledDate && (
                  <Check aria-hidden className="ml-auto size-3.5" />
                )}
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
          <RowActions
            label={item.name}
            actions={[
              {
                label: "할일 삭제",
                destructive: true,
                onSelect: () => boardActions.deleteTask(projectId, item.id),
              },
            ]}
          />
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
  );
}

// 프로젝트 상세의 우측 패널 — 예정일도 단계도 없는 '백로그' 할일만 보여준다.
// '단계 없음'(예정일은 있으나 단계에 안 든 할일)은 보드의 별도 컬럼으로 옮겼다.
// 이 패널로 드래그해 놓으면(단계에서 빼기) 예정일이 해제돼 백로그로 간다.
export function ProjectBacklog({ projectId }: { projectId: string }) {
  const { backlog, stages } = useProjectBoard(projectId);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  // 보드(단계) 카드를 끌어와 놓으면 백로그로 되돌린다 — 놓일 자리를 하이라이트한다
  const [dropActive, setDropActive] = useState(false);
  // 화면 어디서든 타이핑하면 이 입력으로 캡처한다
  const addInputRef = useRef<HTMLInputElement>(null);
  useTypeToFocus(addInputRef);

  // 예정일도 단계도 없는 할일만 이 패널에 남긴다.
  const parked = backlog.filter((task) => !task.scheduledDate);

  return (
    <aside
      onDragOver={(event) => {
        // 백로그 카드끼리의 드래그도 걸리지만, 같은 자리 드롭은 assignTask가 걸러낸다
        if (!isTaskDrag(event)) return;
        event.preventDefault(); // 기본값은 '드롭 금지'라 막아줘야 놓을 수 있다
        event.dataTransfer.dropEffect = "move";
        setDropActive(true);
      }}
      onDragLeave={(event) => {
        // 자식 위로 옮겨갈 때도 leave가 뜨므로 영역 밖으로 나갔을 때만 끈다
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setDropActive(false);
      }}
      onDrop={(event) => {
        const taskId = getTaskDragData(event);
        setDropActive(false);
        if (!taskId) return;
        event.preventDefault();
        // 단계 → 백로그(단계 null). 예정일은 assignTask가 일정 미정으로 되돌린다.
        boardActions.assignTask(projectId, taskId, projectId, null);
      }}
      className={cn(
        "flex w-[300px] shrink-0 flex-col gap-3.5 overflow-y-auto rounded-[8px] border bg-background p-3.5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.05)] transition-shadow",
        dropActive && "ring-2 ring-primary ring-offset-1",
      )}
    >
      {/* 백로그 — 예정일도 단계도 없는 할일.
          '단계 없음'(예정일 있음)은 보드의 별도 컬럼으로 옮겼다(project-board). */}
      <section className="flex shrink-0 flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <h2 className="text-[13.5px] font-semibold">백로그</h2>
          <span className="text-xs font-medium text-muted-foreground">
            {parked.length}
          </span>
        </div>
        <div className="flex h-8 shrink-0 items-center rounded-[8px] bg-muted px-2.5 focus-within:ring-1 focus-within:ring-primary">
          <input
            ref={addInputRef}
            // 화면에 들어오면 입력창에 커서를 둬, 클릭 없이 바로 쳐서 Enter로 추가할 수 있게 한다
            autoFocus
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
        {parked.map((item) => (
          <BacklogRow
            key={item.id}
            projectId={projectId}
            stages={stages}
            item={item}
            onOpenDetail={setDetailTaskId}
          />
        ))}
      </section>

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
