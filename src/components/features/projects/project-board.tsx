"use client";

import { useState } from "react";
import { Ellipsis } from "lucide-react";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  boardActions,
  useProjectBoard,
} from "@/components/features/projects/board-store";
import { formatShort } from "@/components/features/projects/roadmap-utils";

export function ProjectBoard({ projectId }: { projectId: string }) {
  const { stages } = useProjectBoard(projectId);
  const [addingStageId, setAddingStageId] = useState<string | null>(null);

  return (
    <div className="flex min-h-0 flex-1 items-start gap-2.5 overflow-x-auto">
      {stages.map((stage) => {
        const countLabel =
          stage.showDeadline && stage.startDate
            ? `${formatShort(stage.startDate)}~${stage.endDate ? formatShort(stage.endDate) : ""} · ${stage.tasks.length}`
            : `${stage.tasks.length}`;
        return (
          <section
            key={stage.id}
            className="flex w-[260px] shrink-0 flex-col gap-1.5 rounded-[8px] bg-border p-2"
          >
            <header className="flex items-center gap-[7px] py-0.5 pl-1 pr-0.5">
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
              <button
                type="button"
                aria-label={`${stage.name} 단계 메뉴`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <Ellipsis className="size-3.5" />
              </button>
            </header>
            {stage.tasks.map((task) => (
              <div
                key={task.id}
                className="flex w-full items-center gap-2 rounded-[8px] bg-background px-2.5 py-2 shadow-xs"
              >
                <Checkbox
                  aria-label={`${task.name} 완료`}
                  checked={task.done}
                  onCheckedChange={() =>
                    boardActions.toggleTask(projectId, stage.id, task.id)
                  }
                  className="rounded-[4px] border-primary"
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px] font-medium leading-[18px]",
                    task.done && "text-muted-foreground line-through",
                  )}
                >
                  {task.name}
                </span>
              </div>
            ))}
            {addingStageId === stage.id ? (
              <div className="flex w-full items-center gap-2 rounded-[8px] border-[1.5px] border-primary bg-background px-2.5 py-2 shadow-xs">
                <input
                  autoFocus
                  placeholder="작업명 입력 후 Enter"
                  aria-label={`${stage.name} 작업 추가`}
                  className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      const name = event.currentTarget.value.trim();
                      if (name) boardActions.addTask(projectId, stage.id, name);
                      setAddingStageId(null);
                    }
                    if (event.key === "Escape") setAddingStageId(null);
                  }}
                  onBlur={() => setAddingStageId(null)}
                />
                <span aria-hidden className="text-[11px] text-muted-foreground">
                  ↵
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingStageId(stage.id)}
                className="flex w-full items-center rounded-[8px] py-[5px] pl-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
              >
                ＋ 작업
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
