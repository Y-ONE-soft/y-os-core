import { Ellipsis } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { STAGES } from "@/components/features/projects/project-detail-data";

export function ProjectBoard() {
  return (
    <div className="flex min-h-0 flex-1 items-stretch gap-2.5 overflow-x-auto">
      {STAGES.map((stage) => (
        <section
          key={stage.id}
          className="flex w-[260px] shrink-0 flex-col gap-1.5 rounded-[12px] bg-border p-2"
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
              {stage.countLabel}
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
                className="rounded-[4px] border-primary"
              />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-[18px]">
                {task.name}
              </span>
            </div>
          ))}
          {stage.showAddingCard ? (
            <div className="flex w-full items-center gap-2 rounded-[8px] border-[1.5px] border-primary bg-background px-2.5 py-2 shadow-xs">
              <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                작업명 입력 후 Enter
              </span>
              <span aria-hidden className="text-[11px] text-muted-foreground">
                ↵
              </span>
            </div>
          ) : (
            <button
              type="button"
              className="flex w-full items-center rounded-[8px] py-[5px] pl-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
            >
              ＋ 작업
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
