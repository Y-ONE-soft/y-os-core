"use client";

import { cn } from "@/lib/utils";
import type { CalendarView } from "@/components/features/my-work/my-work-month";

// 캘린더 보기 세그먼트 + 오늘로 돌아가기. 스타일은 로드맵 레인지 스위처와 같은 규격
// (bg-muted p-[3px], 활성만 bg-background + 미세 그림자).

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "day", label: "일" },
  { key: "week", label: "주" },
  { key: "month", label: "월" },
];

export function MyWorkCalendarToolbar({
  view,
  onViewChange,
  onToday,
  className,
}: {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onToday: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={onToday}
        className="rounded-[8px] border px-2.5 py-[5px] text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
      >
        오늘로 돌아가기
      </button>
      <div className="flex items-center gap-0.5 rounded-[8px] bg-muted p-[3px]">
        {VIEWS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={option.key === view}
            onClick={() => onViewChange(option.key)}
            className={cn(
              "rounded-[6px] px-[9px] py-[3px] text-[11px] font-medium transition-colors",
              option.key === view
                ? "bg-background text-foreground shadow-[0px_1px_2px_0px_rgba(0,0,0,0.08)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
