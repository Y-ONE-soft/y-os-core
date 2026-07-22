import { cn } from "@/lib/utils";
import { avatarColor } from "@/lib/avatar-color";
import type { WorkspaceMember } from "@/types/workspace";

/**
 * 작업자 표시 — 주 작업자와 수락된 공동 작업자를 아바타+이름으로 나열한다.
 * 프로젝트 상세·단계 상세·할일 상세가 같은 모양을 쓰도록 한 곳에 둔다.
 *
 * 고르는 UI가 아니라 "지금 누가 하고 있는지"를 보여주는 표시 전용이다.
 */
export function AssigneeList({
  assignee,
  collaborators,
  emptyLabel = "미배정",
  className,
}: {
  /** 주 작업자 — 할일은 담당자, 프로젝트·단계는 프로젝트 작업자 */
  assignee?: WorkspaceMember;
  /** 지정 요청이 수락된 사람들 */
  collaborators?: WorkspaceMember[];
  emptyLabel?: string;
  className?: string;
}) {
  // 주 작업자가 공동 작업자로도 잡혀 있으면 한 번만 보여준다
  const extras = (collaborators ?? []).filter(
    (member) => member.id !== assignee?.id,
  );
  const members = assignee ? [assignee, ...extras] : extras;

  if (members.length === 0) {
    return (
      <p className={cn("text-[13px] text-muted-foreground", className)}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5", className)}>
      {members.map((member, index) => (
        <li key={member.id} className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden
            className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-background"
            style={{ backgroundColor: avatarColor(member.id) }}
          >
            {member.name.slice(0, 1)}
          </span>
          <span className="min-w-0 truncate text-[13px]">{member.name}</span>
          {/* 첫 번째가 주 작업자 — 나머지는 수락된 공동 작업자임을 구분해준다 */}
          {assignee && index > 0 && (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              공동
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
