"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { MY_TASKS_SEED } from "@/components/features/my-work/my-work-data";

type MyTask = { id: string; name: string; done: boolean };

export function MyWorkAside() {
  const [tasks, setTasks] = useState<MyTask[]>(() =>
    MY_TASKS_SEED.map((name, index) => ({
      id: `mt-${index}`,
      name,
      done: false,
    })),
  );

  const toggle = (id: string) =>
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    );

  return (
    <aside className="flex w-[300px] shrink-0 flex-col gap-2 self-stretch overflow-y-auto rounded-[8px] border bg-background p-3.5 shadow-[0px_1px_3px_0px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-1.5">
        <h2 className="text-[13.5px] font-semibold">내 작업</h2>
        <span className="text-xs font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div className="flex h-8 shrink-0 items-center rounded-[8px] bg-muted px-2.5 focus-within:ring-1 focus-within:ring-primary">
        <input
          placeholder="＋ 작업 이름 입력 후 Enter"
          aria-label="내 작업 추가"
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              const name = event.currentTarget.value.trim();
              if (name) {
                setTasks((prev) => [
                  ...prev,
                  { id: `mt-${Date.now()}`, name, done: false },
                ]);
                event.currentTarget.value = "";
              }
            }
          }}
        />
      </div>
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex shrink-0 items-center gap-2 rounded-[8px] bg-muted px-2.5 py-2"
        >
          <Checkbox
            aria-label={`${task.name} 완료`}
            checked={task.done}
            onCheckedChange={() => toggle(task.id)}
            className="rounded-[4px] border-primary bg-background"
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
      <p className="text-[11px] leading-normal text-muted-foreground">
        백로그를 날짜 칸으로 드래그하면 일정이 잡힙니다.
      </p>
    </aside>
  );
}
