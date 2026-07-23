"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { avatarColor } from "@/lib/avatar-color";
import { Checkbox } from "@/components/ui/checkbox";
import type { BoardTask, Project } from "@/types/workspace";
import type { DirectoryUser } from "@/types/users";
import { useUsers } from "@/hooks/use-users";
import {
  boardActions,
  useBoardState,
} from "@/components/features/projects/board-store";
import { TaskDetailOverlay } from "@/components/features/projects/task-detail-overlay";
import { toISO } from "@/components/features/projects/roadmap-utils";

// Figma: Task Status Layout — Master · Assignee (207:892), 보드 본체 207:1189
// 로드맵이 "언제"를, 캘린더가 "며칠에"를 본다면, 이 뷰는 **"누가"**를 본다.
// 담당자별 컬럼에 할일 카드를 쌓고, 머리에 부하(진척)를 얹는다.
// 보이는 범위는 호출부가 정한다 — 마스터는 전체 직원, 스탭은 자기 것만.

/** 미배정 컬럼의 가상 담당자 id — 실제 User.id와 겹치지 않도록 접두사를 뗀 표식 */
const UNASSIGNED_KEY = "__unassigned__";

type AssigneeCard = {
  task: BoardTask;
  projectId: string;
  projectColor: string;
  stageId: string | null;
  /** 예정일이 오늘보다 이르고 아직 안 끝난 할일 */
  overdue: boolean;
};

type AssigneeColumn = {
  key: string;
  name: string;
  /** 직책 — 미배정 컬럼은 "담당자 없음" */
  subtitle: string;
  /** 아바타 배경색. 미배정은 muted */
  color: string;
  /** 아바타에 넣을 글자 */
  initial: string;
  cards: AssigneeCard[];
  done: number;
  total: number;
  overdue: number;
};

function ColumnHead({ column }: { column: AssigneeColumn }) {
  // 지연된 할일이 있으면 수치와 막대를 경고색으로 — 디자인의 빨강 상태가 이 경우다
  const alert = column.overdue > 0;
  const ratio = column.total === 0 ? 0 : column.done / column.total;

  return (
    <>
      <div className="flex w-full shrink-0 items-center gap-2 px-1">
        <span
          aria-hidden
          className="flex size-[26px] shrink-0 items-center justify-center rounded-full text-[11px] font-medium text-background"
          style={{ backgroundColor: column.color }}
        >
          {column.initial}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="truncate text-[13px] font-semibold">
            {column.name}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {column.subtitle}
          </span>
        </span>
        <span
          title={
            alert
              ? `지연 ${column.overdue}건 — 예정일이 지났는데 끝나지 않은 할일`
              : undefined
          }
          className={cn(
            "shrink-0 text-xs font-medium",
            alert ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {column.done}/{column.total}
        </span>
      </div>
      {/* 진척 막대 — 완료 비율. 지연이 있으면 경고색으로 바뀐다 */}
      <div
        role="progressbar"
        aria-label={`${column.name} 진척`}
        aria-valuemin={0}
        aria-valuemax={column.total}
        aria-valuenow={column.done}
        className="h-1 w-full shrink-0 overflow-hidden rounded-full bg-border"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            alert ? "bg-destructive" : "bg-emerald-500",
          )}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </>
  );
}

export function TaskStatusAssignees({
  projects,
  isMaster,
  currentUserId,
}: {
  projects: Project[];
  isMaster: boolean;
  /** 스탭이면 이 사람의 컬럼만 만든다 */
  currentUserId: string | null;
}) {
  const boards = useBoardState();
  const { users, loading } = useUsers();
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  // 지연 판정 기준 — 세션 로딩 이후 클라이언트에서만 첫 렌더되므로 지연 초기화가 안전하다
  const [today] = useState(() => toISO(new Date()));

  const columns = useMemo<AssigneeColumn[]>(() => {
    // 필터에 걸린 프로젝트의 할일만 모은다 (단계에 편성된 것 + 백로그)
    const cards: AssigneeCard[] = [];
    for (const project of projects) {
      const board = boards[project.id];
      if (!board) continue;
      const push = (task: BoardTask, stageId: string | null) =>
        cards.push({
          task,
          projectId: project.id,
          projectColor: project.color,
          stageId,
          // 지연 = 마감일이 지난 미완료. 예정일(scheduledDate)은 미완료면 매일
          // 오늘로 자동 이월되므로 "예정일 < 오늘"은 항상 거짓이 된다 — 고정값인
          // 마감일(deadline)로 판정해야 이월과 무관하게 지연이 잡힌다.
          overdue: !task.done && !!task.deadline && task.deadline < today,
        });
      for (const stage of board.stages) {
        for (const task of stage.tasks) push(task, stage.id);
      }
      for (const task of board.backlog) push(task, null);
    }

    const byAssignee = new Map<string, AssigneeCard[]>();
    for (const card of cards) {
      const key = card.task.assigneeId ?? UNASSIGNED_KEY;
      const list = byAssignee.get(key);
      if (list) list.push(card);
      else byAssignee.set(key, [card]);
    }

    const build = (
      key: string,
      name: string,
      subtitle: string,
      color: string,
      initial: string,
    ): AssigneeColumn => {
      const list = byAssignee.get(key) ?? [];
      return {
        key,
        name,
        subtitle,
        color,
        initial,
        cards: list,
        done: list.filter((card) => card.task.done).length,
        total: list.length,
        overdue: list.filter((card) => card.overdue).length,
      };
    };

    const forUser = (member: DirectoryUser) =>
      build(
        member.id,
        member.name,
        member.title ?? "직책 없음",
        avatarColor(member.id),
        member.name.slice(0, 1),
      );

    // 스탭은 자기 컬럼만 본다 — 남의 할일은 보이지 않아야 한다
    if (!isMaster) {
      const me = users.find((member) => member.id === currentUserId);
      return me ? [forUser(me)] : [];
    }

    // 마스터는 전체 직원 + 미배정(맨 뒤)
    return [
      ...users.map(forUser),
      build(
        UNASSIGNED_KEY,
        "미배정",
        "담당자 없음",
        "var(--muted-foreground)",
        "—",
      ),
    ];
  }, [boards, projects, users, isMaster, currentUserId, today]);

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-[12px] border border-dashed">
        <p className="text-[13px] text-muted-foreground">
          직원 목록을 불러오는 중입니다.
        </p>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-[12px] border border-dashed">
        <p className="text-[13px] text-muted-foreground">
          표시할 담당자가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 gap-2.5 overflow-x-auto">
      {columns.map((column) => (
        // 디자인은 컬럼이 너비를 균등하게 채운다(flex-1). 다만 인원이 늘면 무한정
        // 좁아지므로 하한을 두고, 하한에 걸리면 가로 스크롤로 넘긴다.
        <section
          key={column.key}
          className="flex min-h-0 min-w-[220px] flex-1 flex-col gap-1.5 rounded-[8px] bg-border px-2 py-2.5"
        >
          <ColumnHead column={column} />
          {/* 카드 영역만 스크롤 — 컬럼은 보드 높이를 꽉 채운다 */}
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
            {column.cards.map((card) => (
              // 카드 자체가 하나의 '할일' 컴포넌트 — 호버하면 선택된 것처럼 보이고
              // 어디를 눌러도 상세가 열린다(체크박스만 예외). docs/94와 같은 규약.
              <div
                key={card.task.id}
                role="button"
                tabIndex={0}
                onClick={() => setDetailTaskId(card.task.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setDetailTaskId(card.task.id);
                  }
                }}
                className={cn(
                  "flex w-full shrink-0 cursor-pointer items-center gap-2 rounded-[8px] px-2.5 py-2 transition-shadow outline-none",
                  "hover:ring-2 hover:ring-primary/50 focus-visible:ring-2 focus-visible:ring-ring",
                  card.task.done
                    ? "bg-muted opacity-60"
                    : "bg-background shadow-xs",
                )}
              >
                <span
                  onClick={(event) => event.stopPropagation()}
                  className="flex shrink-0 items-center"
                >
                  <Checkbox
                    aria-label={`${card.task.name} 완료`}
                    checked={card.task.done}
                    onCheckedChange={() =>
                      boardActions.toggleTask(
                        card.projectId,
                        card.stageId,
                        card.task.id,
                      )
                    }
                    className="rounded-[4px] border-primary"
                  />
                </span>
                <span
                  aria-hidden
                  className="size-[7px] shrink-0 rounded-full"
                  style={{ backgroundColor: card.projectColor }}
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-left text-[12.5px] font-medium leading-[17px]",
                    card.task.done && "text-muted-foreground line-through",
                  )}
                >
                  {card.task.name}
                </span>
                {/* 상태는 할 일 / 완료 둘뿐이다. 예정일이 지난 할일은 상태를
                    늘리는 대신 같은 칩을 경고색으로 칠해 알린다 */}
                <span
                  title={
                    card.overdue
                      ? `마감 ${card.task.deadline} — 지났습니다`
                      : undefined
                  }
                  className={cn(
                    "shrink-0 rounded-full border px-1.5 py-px text-[10.5px] font-medium",
                    card.task.done
                      ? "text-muted-foreground"
                      : card.overdue
                        ? "border-destructive/40 text-destructive"
                        : "text-foreground",
                  )}
                >
                  {card.task.done ? "완료" : "할 일"}
                </span>
              </div>
            ))}
            {column.cards.length === 0 && (
              <p className="px-1 py-2 text-[11px] text-muted-foreground">
                담당한 할일이 없습니다.
              </p>
            )}
          </div>
        </section>
      ))}
      <TaskDetailOverlay
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
      />
    </div>
  );
}
