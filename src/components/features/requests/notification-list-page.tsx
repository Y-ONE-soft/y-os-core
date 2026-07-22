"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequests } from "@/hooks/use-requests";
import { RequestCard } from "@/components/features/requests/request-card";
import type { WorkRequest } from "@/types/requests";

// 알림 페이지 — 주고받은 요청을 한 화면에서 훑고 처리한다.
// 알림 도메인은 따로 없고 Request(할일 요청·도움 요청)가 곧 알림이다.
// 내 할일의 "요청 알림" 띠와 같은 스토어(useRequests)를 보므로, 한쪽에서 수락하면
// 다른 쪽도 같이 갱신된다.

type Filter = "received" | "sent" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "received", label: "받은 요청" },
  { key: "sent", label: "보낸 요청" },
  { key: "all", label: "전체" },
];

function matches(request: WorkRequest, filter: Filter) {
  return filter === "all" || request.direction === filter;
}

/** 대기 중이 먼저, 그 안에서는 최신순 (createdAt은 ISO라 문자열 비교로 충분하다) */
function sortForList(list: WorkRequest[]) {
  return [...list].sort((a, b) => {
    const pending =
      (a.status === "PENDING" ? 0 : 1) - (b.status === "PENDING" ? 0 : 1);
    return pending !== 0 ? pending : b.createdAt.localeCompare(a.createdAt);
  });
}

export function NotificationListPage() {
  // 배지가 세는 것과 같은 "받은 요청 중 대기"가 기본 관심사다
  const [filter, setFilter] = useState<Filter>("received");
  const { requests, loading } = useRequests();

  const visible = sortForList(requests.filter((item) => matches(item, filter)));
  const pendingCount = requests.filter(
    (item) => item.status === "PENDING" && item.direction === "received",
  ).length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-6 pb-6 pt-5">
      <header className="flex shrink-0 flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold">알림</h1>
        <p className="text-[13px] text-muted-foreground">
          {pendingCount > 0
            ? `처리를 기다리는 요청이 ${pendingCount}건 있습니다`
            : "주고받은 할일 요청과 도움 요청입니다"}
        </p>
      </header>

      {/* 방향 필터 — 건수를 함께 보여줘야 다른 탭이 비어 보이지 않는다 */}
      <div className="flex shrink-0 items-center gap-1.5">
        {FILTERS.map(({ key, label }) => {
          const count = requests.filter((item) => matches(item, key)).length;
          const active = key === filter;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(key)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-[8px] border px-3 text-[13px] font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {label}
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <ul className="flex flex-col gap-2" aria-busy>
          {[0, 1, 2].map((row) => (
            <li key={row}>
              <Skeleton className="h-[104px] w-full rounded-[10px]" />
            </li>
          ))}
        </ul>
      ) : visible.length === 0 ? (
        <p className="flex h-9 items-center rounded-[8px] border border-dashed px-3 text-[13px] text-muted-foreground">
          {filter === "received"
            ? "받은 요청이 없습니다."
            : filter === "sent"
              ? "보낸 요청이 없습니다. 단계·할일 상세에서 공동 작업자 지정이나 도움 요청을 보낼 수 있습니다."
              : "주고받은 요청이 없습니다."}
        </p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          {visible.map((request) => (
            <li key={request.id} className="flex">
              <RequestCard request={request} className="w-full" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
