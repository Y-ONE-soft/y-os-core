"use client";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  boardActions,
  useProjectBoard,
} from "@/components/features/projects/board-store";

export function ProjectBacklog({ projectId }: { projectId: string }) {
  const { backlog } = useProjectBoard(projectId);

  return (
    <aside className="flex w-[300px] shrink-0 flex-col gap-2 rounded-[12px] border bg-background p-3.5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-1.5">
        <h2 className="text-[13.5px] font-semibold">백로그</h2>
        <span className="text-xs font-medium text-muted-foreground">
          {backlog.length}
        </span>
      </div>
      <div className="flex h-8 shrink-0 items-center rounded-[8px] bg-muted px-2.5 focus-within:ring-1 focus-within:ring-primary">
        <input
          placeholder="＋ 작업 이름 입력 후 Enter"
          aria-label="백로그 작업 추가"
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
        <div
          key={item.id}
          className="flex items-center gap-2 rounded-[8px] bg-muted px-2.5 py-2"
        >
          <Checkbox
            aria-label={`${item.name} 완료`}
            checked={item.done}
            onCheckedChange={() =>
              boardActions.toggleTask(projectId, null, item.id)
            }
            className="rounded-[4px] border-primary bg-background"
          />
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[13px] font-medium leading-[18px]",
              item.done && "text-muted-foreground line-through",
            )}
          >
            {item.name}
          </span>
        </div>
      ))}
      <p className="text-[11px] leading-normal text-muted-foreground">
        백로그 → 단계로 드래그하면 편입됩니다. 보드 카드를 이 영역으로
        드래그하면 백로그로 이동합니다.
      </p>
    </aside>
  );
}
