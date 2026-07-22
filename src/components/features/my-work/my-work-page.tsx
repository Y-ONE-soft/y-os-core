import { cn } from "@/lib/utils";
import { MyWorkCalendarPanel } from "@/components/features/my-work/my-work-calendar-panel";
import { MyWorkRequests } from "@/components/features/my-work/my-work-requests";
import { MyWorkBacklog } from "@/components/features/my-work/my-work-backlog";

const VIEW_TABS = ["캘린더", "타임라인"] as const;
const ACTIVE_VIEW = "캘린더";

const FILTERS = ["🔍 필터", "담당자 1 ▾", "프로젝트 ▾"] as const;

export function MyWorkPage() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-6 pb-6 pt-5">
      <header className="flex shrink-0 flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold">내 할일</h1>
        <p className="text-[13px] text-muted-foreground">
          백로그를 날짜로 드래그해 일정을 잡으세요
        </p>
      </header>
      <nav aria-label="내 할일 뷰 전환" className="shrink-0">
        <ul className="flex items-center gap-1">
          {VIEW_TABS.map((tab) => {
            const active = tab === ACTIVE_VIEW;
            return (
              <li key={tab}>
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            className="rounded-[8px] border px-2.5 py-[5px] text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            {filter}
          </button>
        ))}
        <p className="text-[11px] text-muted-foreground">
          뷰에만 적용 · &lsquo;내 할일&rsquo;과 독립
        </p>
      </div>
      <div className="flex min-h-0 flex-1 items-stretch gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <MyWorkCalendarPanel />
          <MyWorkRequests />
        </div>
        <MyWorkBacklog />
      </div>
    </div>
  );
}
