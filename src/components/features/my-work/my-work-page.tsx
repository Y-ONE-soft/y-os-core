import Link from "next/link";

import { cn } from "@/lib/utils";
import { MyWorkCalendarPanel } from "@/components/features/my-work/my-work-calendar-panel";
import { MyWorkTimelinePanel } from "@/components/features/my-work/my-work-timeline-panel";
import { MyWorkRequests } from "@/components/features/my-work/my-work-requests";
import { MyWorkBacklog } from "@/components/features/my-work/my-work-backlog";
import { ProjectCreateButton } from "@/components/features/projects/project-create-button";

export type MyWorkView = "calendar" | "timeline";

const VIEW_TABS: { key: MyWorkView; label: string; href: string }[] = [
  { key: "calendar", label: "캘린더", href: "/projects/my-tasks" },
  { key: "timeline", label: "타임라인", href: "/projects/my-tasks?view=timeline" },
];

const FILTERS = ["🔍 필터", "담당자 1 ▾", "프로젝트 ▾"] as const;

export function MyWorkPage({ view }: { view: MyWorkView }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-6 pb-6 pt-5">
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[22px] font-semibold">내 할일</h1>
          <p className="text-[13px] text-muted-foreground">
            백로그를 날짜로 드래그해 일정을 잡으세요
          </p>
        </div>
        <ProjectCreateButton />
      </header>
      <nav aria-label="내 할일 뷰 전환" className="shrink-0">
        <ul className="flex items-center gap-1">
          {VIEW_TABS.map((tab) => {
            const active = tab.key === view;
            return (
              <li key={tab.key}>
                <Link
                  href={tab.href}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "block rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </Link>
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
          {view === "timeline" ? <MyWorkTimelinePanel /> : <MyWorkCalendarPanel />}
          <MyWorkRequests />
        </div>
        <MyWorkBacklog />
      </div>
    </div>
  );
}
