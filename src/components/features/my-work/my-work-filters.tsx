"use client";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { avatarColor } from "@/lib/avatar-color";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUsers } from "@/hooks/use-users";
import { useSession } from "@/components/features/auth/session-context";
import { useProjectStore } from "@/components/features/projects/project-store";
import {
  myWorkFilterActions,
  useMyWorkFilter,
} from "@/components/features/my-work/my-work-filter-store";

/** 체크박스 목록을 담는 드롭다운 하나 */
function CheckboxFilter({
  label,
  summary,
  items,
  selected,
  onToggle,
}: {
  label: string;
  summary: string;
  items: { id: string; name: string; hint?: string; color?: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label} 필터`}
        className={cn(
          "flex items-center gap-1 rounded-[8px] border px-2.5 py-[5px] text-xs font-medium transition-colors",
          selected.length > 0
            ? "border-primary bg-primary/5 text-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )}
      >
        {summary}
        <ChevronDown aria-hidden className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px] p-1.5">
        {items.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            선택할 항목이 없습니다.
          </p>
        ) : (
          <ul className="flex max-h-[240px] flex-col overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 transition-colors hover:bg-accent/60">
                  <Checkbox
                    checked={selected.includes(item.id)}
                    onCheckedChange={() => onToggle(item.id)}
                    aria-label={`${item.name} 선택`}
                    className="rounded-[4px] border-primary"
                  />
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color ?? avatarColor(item.id) }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {item.name}
                  </span>
                  {item.hint && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {item.hint}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MyWorkFilters() {
  const { user } = useSession();
  const { users } = useUsers();
  const { groups } = useProjectStore();
  const filter = useMyWorkFilter();

  const assigneeIds = filter.assigneeIds ?? [];
  const projectIds = filter.projectIds ?? [];
  const allProjects = groups.flatMap((group) => group.projects);

  // 담당자 미선택 = 기본값(나) — 요약에도 그대로 드러낸다
  const assigneeSummary =
    assigneeIds.length === 0
      ? `담당자 ${user?.name ?? "나"}`
      : assigneeIds.length === 1
        ? `담당자 ${users.find((u) => u.id === assigneeIds[0])?.name ?? 1}`
        : `담당자 ${assigneeIds.length}`;
  const projectSummary =
    projectIds.length === 0 ? "프로젝트 전체" : `프로젝트 ${projectIds.length}`;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <CheckboxFilter
        label="담당자"
        summary={assigneeSummary}
        items={users.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          hint:
            candidate.title ??
            (candidate.role === "MASTER" ? "마스터" : "스탭"),
        }))}
        selected={assigneeIds}
        onToggle={(id) => myWorkFilterActions.toggleAssignee(id, assigneeIds)}
      />
      <CheckboxFilter
        label="프로젝트"
        summary={projectSummary}
        items={allProjects.map((project) => ({
          id: project.id,
          name: project.name,
          color: project.color,
        }))}
        selected={projectIds}
        onToggle={(id) => myWorkFilterActions.toggleProject(id, projectIds)}
      />
      {(assigneeIds.length > 0 || projectIds.length > 0) && (
        <button
          type="button"
          onClick={() => myWorkFilterActions.reset()}
          className="rounded-[8px] px-2 py-[5px] text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          초기화
        </button>
      )}
      <p className="text-[11px] text-muted-foreground">
        뷰에만 적용 · &lsquo;내 할일&rsquo;과 독립
      </p>
    </div>
  );
}
